# Build plan: demo-ready by Thu 5 Nov 2026

Course 24CIE554 Full Stack Development. The project is shown to the professor on **Thu 5 Nov**
(moved up from the 10 Nov submission: working project, source code, documentation draft,
deployment, an AI assistant integrated with the app's data, a data analytics dashboard with
filters, and a demo of the AI giving insights from the analytics).

Long-term goal: a deployed site that MSRIT students actually use, starting with CSE-AIML
semesters 3 to 6 (2022 to 2025 papers), at close to zero cost. Planned capacity is about 500
concurrent users and 20 searches per second, which is 2 to 3 times the expected exam-week peak
for ~6,000 students.

## Where we are (end of Sun 1 Nov)

Every graded feature is built, tested and on `main`:

- Exam insights (`/analytics`): filters, KPIs, charts, takeaways, repeated questions.
- AI study assistant: answers from the archive only, with citations; "Ask about this view" on
  the insights page answers from the filtered slice.
- Moderators' dashboard (`/dashboard`) on the real accounts: review queue, topics, papers, users.
- Deployment-ready server: campus-sized rate limits, search cache, Docker image, PDFs opened at
  their source link (`npm run files:prune`).

The whole project already runs on a laptop, so the demo has a fallback whatever happens to
hosting.

## Hosting (free tiers)

| Piece | Where |
| ----- | ----- |
| Frontend (Next.js) | Vercel |
| Database, Atlas Search, Vector Search | MongoDB Atlas M0 |
| Paper PDFs | Their original source links (Google Drive); not stored after ingestion |
| API server | Oracle Cloud Always Free (fallback: Render free) |
| Verification email | Brevo |
| AI answers | Gemini free API key |

Paper ingestion runs locally (Claude Code headless with Haiku) against the Atlas database; the
deployed server only serves search and the API (`RUN_WORKER=false`).

## Day by day

### Mon 2 Nov: go live
- **You:** create the Atlas (M0), Vercel, server host (Oracle or Render) and Brevo accounts;
  put the Atlas connection string in `server/.env` yourself.
- **Teammate:** first batch of papers (with their Drive links) and the sem 3 to 6 scheme PDFs,
  by Monday night.
- **Me:** Atlas search indexes and course seed; deploy the API; deploy the site on Vercel (the
  build runs `npm run seed -w client` for the past-papers library); set `TRUST_PROXY`,
  `NODE_ENV=production`; Brevo for verification email.
- **Done when:** someone registers with an `@msrit.edu` address on the live URL and searches
  from a phone.

### Tue 3 Nov: real data
- Ingest the teammate's papers locally against Atlas; `npm run files:prune` after the batch.
- Approve the topic list on the dashboard (merge obvious duplicates first); clear flagged questions.
- Scheme JSONs for semesters 3 to 6 so each course links to its papers.
- Check `/analytics` and the assistant on CSE-AIML courses: the demo views must look right.

### Wed 4 Nov: demo-ready
- Demo script: insights filtered to one course → "Ask about this view" → assistant with
  citations → dashboard (roles, review, topics) → search.
- Rehearse once end to end on the live URL, and once on the laptop as the fallback.
- Documentation draft: README, architecture diagram, API reference; screenshots for the report.
- A short load test against the live site if time allows (otherwise quote the capacity estimate).

### Thu 5 Nov: show the professor
- Morning: smoke-test the live site; laptop running locally as the backup.

### After the demo (by 10 Nov)
- Diagram questions, small version: "Includes diagram" badge and "draw/sketch" tag.
- Soft launch to the CSE-AIML class; fix what real users hit.

## If we fall behind, cut in this order
1. Load test (use the capacity estimate instead).
2. Scheme JSONs for every semester (do the demo courses only).
3. Live deployment for the demo (show it on the laptop; deploy right after).

The data for the demo courses and the demo rehearsal are not cut.

**Main risk:** papers arriving late. If they are not in by Tuesday morning, the demo uses the
39 papers already indexed, filtered to the courses that look best, and the rest goes in after.

## Later
- Diagram questions, full version: render each question's region of the page to an image and
  show it under the result; have the model describe the figure during ingestion so it's searchable.
- 17 Nov: report review (system design, implementation, results and screenshots).
- 30 Nov: final ZIP, report and PPT.
