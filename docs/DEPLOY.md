# Deploying ConceptQuery

Three pieces, all with free tiers:

| Piece    | Where (suggested)                        | What it runs                                   |
| -------- | ---------------------------------------- | ---------------------------------------------- |
| Database | MongoDB Atlas M0                          | Data, GridFS PDFs, Atlas Search + Vector Search |
| API      | Render (Docker web service), or any VM   | `server/Dockerfile`, port 4000                 |
| Site     | Vercel (root directory `client`)          | Next.js; forwards `/api/*` to the API          |

The browser only ever talks to the site's origin: `/api/*` is rewritten to `API_URL`, so there
is no CORS setup and the refresh cookie is first-party.

## 1. Database: copy the local archive to Atlas

Create an M0 cluster, a database user, and allow access from anywhere (`0.0.0.0/0`, the API
host's IP changes). Copy the connection string, then from the repo root with the local
container running:

```bash
# everything: papers (GridFS), questions + embeddings, topics, courses, users
docker exec conceptquery-mongo mongodump --db conceptquery --archive > conceptquery.archive
docker run --rm -i mongo:8 mongorestore --uri "<atlas-uri>" --archive --drop < conceptquery.archive

# Atlas Search + Vector Search indexes (waits until they are queryable)
MONGODB_URI="<atlas-uri>/conceptquery" npm run db:indexes -w server
```

The demo accounts in [DEMO.md](DEMO.md) come across with the data. Free PDF space with
`npm run files:prune -w server` if the 512 MB limit gets close.

## 2. API

Render: New → Web Service → this repo → Runtime **Docker**, Dockerfile path
`server/Dockerfile`, Docker build context `.` (the repo root). Health check path `/api/health`.

Environment (see `server/.env.example` for every option):

| Variable              | Value                                                                       |
| --------------------- | --------------------------------------------------------------------------- |
| `MONGODB_URI`         | Atlas URI ending in `/conceptquery`                                          |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | two different random strings, 48+ bytes: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `CLIENT_ORIGIN`       | the site URL, e.g. `https://conceptquery.vercel.app`                         |
| `API_PUBLIC_URL`      | the **site** URL too (verification links go through the site's `/api`)      |
| `TRUST_PROXY`         | `2` (Vercel → Render)                                                         |
| `GEMINI_API_KEY` or `ANTHROPIC_API_KEY` | one is enough; Gemini is tried first, then Claude              |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | required for sign-up: without SMTP the verification link is only written to the server log (Brevo's free plan works) |
| `RUN_WORKER`          | `false` (default in the image). `true` processes uploads on the server (OCR needs more memory than the 512 MB free instance; not measured here) |

Leave `OLLAMA_MODEL` and `USE_CLAUDE_CODE` unset: both need this developer machine.

Check: `https://<api-host>/api/health` returns `{"ok":true,...,"llm":["anthropic"]}` (or
`gemini`).

## 3. Site

Vercel: New Project → this repo → Root Directory `client` (framework Next.js is detected).
Environment: `API_URL=https://<api-host>` (no trailing slash). Deploy.

The build seeds the past-papers library (`client/data/msrit.db`) from
`client/data/sources/external-papers.json` and bundles it with the pages; nothing else is
needed.

## 4. After the first deploy

1. Sign in as the moderator; open `/search`, `/analytics`, `/papers` and ask the assistant
   one question to confirm the database, search indexes and model key.
2. Change the demo passwords, or make your own moderator:
   `MONGODB_URI=<atlas-uri>/conceptquery npm run user:role -w server -- you@msrit.edu moderator`.
3. Uploads: with `RUN_WORKER=false`, run the worker from a developer machine against Atlas
   (`MONGODB_URI=<atlas-uri>/conceptquery npm run dev:server`) to process queued papers.

## Free-tier notes

- Render's free web service sleeps after 15 minutes idle; the first request then takes
  ~30–60 s and the site shows its error page until the API is up. Open `/api/health` a minute
  before a demo, or use a paid instance / an always-on VM.
- AI answers are capped per student and per day (`ASSISTANT_USER_DAILY`,
  `ASSISTANT_GLOBAL_DAILY`) so a key can't be run up by traffic.
