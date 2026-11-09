# ConceptQuery (MSRIT Notes Hub)

A topic-aware search engine for Ramaiah Institute of Technology's previous year question
papers and notes. Papers are split into individual questions, tagged with the concepts
they examine, embedded as vectors and indexed, so a student can find every question on a
topic across years and subjects, with a citation back to the paper, year and question number.

```
client/   Next.js (React) site; /api/* is forwarded to the server
server/   Express API + ingestion worker (MongoDB Atlas, Atlas Search, Atlas Vector Search)
```

## Running it

Three terminals, from the repo root (Docker Desktop must be running):

```bash
npm run db:up        # MongoDB
npm run dev:server   # API on http://localhost:4000
npm run dev:client   # site on http://localhost:3000
```

The site reads everything from the API except the past-papers library (links to papers on
other student sites), which lives in a local SQLite file built by `npm run seed -w client`.
Sign in at `/login`; uploaders and moderators get `/upload`, moderators get `/dashboard`.

## Setting up the backend the first time

Needs Node 22+ and Docker Desktop.

```bash
npm install
npm run db:up                         # MongoDB with Search + Vector Search (mongodb-atlas-local)
cp server/.env.example server/.env    # then fill in the two JWT secrets (command is in the file)
npm run db:indexes -w server          # create the search indexes
npm run seed:courses -w server        # load official schemes from server/data/schemes
npm run dev:server                    # API on http://localhost:4000, worker in the same process
```

To use it:

```bash
# register at POST /api/auth/register with an @msrit.edu address; the verification link is
# printed in the server log when SMTP isn't configured. Then give yourself upload rights:
npm run user:role -w server -- you@msrit.edu moderator

# queue a folder of PDFs (or upload through POST /api/documents)
npm run import:papers -w server -- ../samples/papers
```

`server/api.http` walks through every endpoint (VS Code REST Client extension).

Topic tagging and the segmentation fallback need a language model at ingestion time: a free
[Gemini API key](https://aistudio.google.com/apikey) or Groq key in `server/.env`, or, on your
own machine only, `USE_CLAUDE_CODE=true` to run Claude Code headless on your own login.
Without any, everything else works and tagging falls back to nearest-topic matching on
embeddings. Search never calls a model.

No key? Run a model locally with [Ollama](https://ollama.com): `ollama pull qwen2.5:3b`, then
`OLLAMA_MODEL=qwen2.5:3b` in `server/.env`. It is free, works offline, and is used for both
ingestion and the study assistant (after Gemini/Groq when those are configured).

On Windows, if the API exits right after "MongoDB connected", the system Visual C++ runtime is
too old for the embedding model; `npm install` copies a current one next to onnxruntime
(`scripts/fix-onnx-windows.mjs`), or install the latest VC++ Redistributable.

The study assistant (`/assistant`, and "Ask about this view" on `/analytics`) always retrieves
first: the closest questions, topic counts and the statistics for the slice. For a signed-in
student with a Gemini or Groq key configured, a fast model (`ASSISTANT_MODEL`) then writes the
answer from that data only, citing the questions it used; signed-out visitors, students over
the daily cap and any model failure get the retrieval answer instead. Written answers are cached
for 3 days and shared once two students have asked the same thing.

## How it works

### Ingestion (once per uploaded document, in a background worker)

```
upload -> GridFS + job -> extract -> segment -> tag -> embed -> write
```

| Stage   | What happens |
| ------- | ------------ |
| upload  | File type checked from its bytes, SHA-256 duplicate check, stored in GridFS, job queued in Mongo |
| extract | pdf.js text layer, rebuilt into lines from word positions; scanned pages rendered and OCR'd with Tesseract |
| segment | Rule-based parser for MSRIT layouts (Q1 / a) / i), marks, CO, Bloom level, units) plus paper-header metadata. Each question gets a confidence score; low-confidence ones (and papers the parser can't follow) go to the language model |
| tag     | Candidate topics from the controlled vocabulary by embedding similarity; one batched language-model call per paper picks from them or proposes new topics for moderators |
| embed   | `bge-small-en-v1.5` (384-dim) run locally with Transformers.js: no API cost |
| write   | Questions stored with their vectors; near-identical questions across papers grouped (recurrence) |

The worker claims jobs atomically (`findOneAndUpdate`), and each stage saves its output, so
a failed job retries from the stage that failed.

### Search (every query, no language model)

1. **Rule-based query parsing** turns "DAA 10 marks questions from the last 3 years" into
   filters (`courseCodes`, `marks`, `yearFrom`), leaving the topic text.
2. The topic text is run through **Atlas Search** (BM25 keyword ranking) and **Atlas Vector
   Search** (approximate nearest neighbour over the embeddings) with the same filters.
3. The two result lists are merged with **reciprocal rank fusion**.

### Evaluation

`npm run eval -w server` runs the labelled queries in `server/eval/queries.json` in each
mode and reports Recall@10 and MRR.

## API

| Method | Endpoint | Purpose |
| ------ | -------- | ------- |
| POST | `/api/auth/register` · `/login` · `/refresh` · `/logout` | Accounts, JWT access + rotating refresh tokens |
| GET | `/api/auth/verify-email?token=` · `/api/auth/me` | Email verification, current user |
| POST | `/api/documents` | Upload a paper or notes (uploader) |
| GET | `/api/documents` · `/:id` · `/:id/file` · `/:id/questions` | Documents, status, original file, extracted questions |
| POST/DELETE | `/api/documents/:id/reprocess` · `/api/documents/:id` | Re-run the pipeline, remove (moderator) |
| GET | `/api/search?q=&mode=hybrid\|vector\|keyword` | Search with parsed filters |
| GET | `/api/analytics/overview?semester=&course=&yearFrom=&yearTo=&examType=` | Everything the exam-insights page shows for one slice |
| GET | `/api/analytics/topics` · `/distribution?by=` · `/recurring` · `/stats` | Topic frequency, distributions, repeated questions |
| GET | `/api/courses?semester=5` | Current scheme, each course linked to past papers on the same subject |
| GET | `/api/branches` · `/api/catalog?branch=` · `/api/course/:code` | Browsing by branch and course |
| POST | `/api/assistant` | Study assistant: `{question, filters?}`; retrieval, then a cited AI answer for signed-in students |
| GET/POST/PATCH | `/api/topics` | Vocabulary; approve, rename or merge topics (moderator) |
| GET/POST | `/api/review` · `/api/review/:id/resolve` | Moderation queue |
| GET/PATCH/DELETE | `/api/admin/summary` · `/api/admin/users` · `/api/admin/users/:id` | Dashboard numbers, accounts and roles (moderator) |
| POST | `/api/topics/approve` | Approve many proposed topics at once (moderator) |
| PATCH | `/api/questions/:id` | Correct a question; it is re-embedded (moderator) |

## Deploying the API

Full walkthrough (Atlas, Render, Vercel, environment variables): [docs/DEPLOY.md](docs/DEPLOY.md).

```bash
docker build -f server/Dockerfile -t conceptquery-api .      # from the repo root
docker run --env-file server/.env -e NODE_ENV=production -p 4000:4000 conceptquery-api
```

The image (x64 or ARM) serves the API only, with the embedding model baked in; it uses about
200 MB of memory. Ingestion runs on a developer machine against the same database
(`RUN_WORKER=false` in the image). Set `TRUST_PROXY` to the number of proxies in front of it.

Papers imported with a source link (the `url` in `manifest.json`) don't need their PDF kept in
the database once ingested. After a batch, free the space and keep within the free tier:

```bash
npm run files:prune -w server -- --dry-run   # what would be freed
npm run files:prune -w server                # "Open PDF" then goes to the source link
```

Rate limits count per signed-in student where possible, since campus Wi-Fi puts many students
behind one IP (`server/src/middleware/limits.ts`).

## Past-papers library

```bash
npm run seed -w client   # builds client/data/msrit.db from client/data/sources/external-papers.json
```

## Dashboard (moderators)

`/dashboard` is where moderators keep the archive right, on the same accounts as the rest of
the site. The link appears only for moderators, and every action is checked again by the API.

- **Review queue**: questions the pipeline wasn't sure about (unclear splits, scanned text):
  fix the text and marks (the question is re-indexed) or dismiss.
- **Topics**: approve proposed topics one by one or in bulk, rename, or merge a duplicate
  into an existing topic (its questions are re-tagged).
- **Papers**: processing status, reprocess, delete.
- **Users**: search accounts, change roles (student, uploader, moderator), delete accounts.
  Moderators can't change their own role or delete themselves.
- At a glance: papers, questions, topics waiting, AI answers used today, and database storage
  against the free tier's 512 MB.

Make the first moderator from the command line: `npm run user:role -w server -- you@msrit.edu moderator`.
