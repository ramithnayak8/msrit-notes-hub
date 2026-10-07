# ConceptQuery (MSRIT Notes Hub)

A topic-aware search engine for Ramaiah Institute of Technology's previous year question
papers and notes. Papers are split into individual questions, tagged with the concepts
they examine, embedded as vectors and indexed, so a student can find every question on a
topic across years and subjects, with a citation back to the paper, year and question number.

```
client/   Next.js (React) UI
server/   Express API + ingestion worker (MongoDB Atlas, Atlas Search, Atlas Vector Search)
```

> The client still runs on its original placeholder data (SQLite, invented questions).
> Connecting it to the server's API is the next step.

## Running the backend

Needs Node 22+ and Docker Desktop.

```bash
npm install
npm run db:up                         # MongoDB with Search + Vector Search (mongodb-atlas-local)
cp server/.env.example server/.env    # then fill in the two JWT secrets (command is in the file)
npm run db:indexes -w server          # create the search indexes
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

Topic tagging needs a free [Gemini API key](https://aistudio.google.com/apikey) (or a Groq
key) in `server/.env`. Without one, everything else works and tagging falls back to
nearest-topic matching on embeddings.

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
| GET | `/api/analytics/topics` · `/distribution?by=` · `/recurring` · `/stats` | Topic frequency, distributions, repeated questions |
| GET/POST/PATCH | `/api/topics` | Vocabulary; approve, rename or merge topics (moderator) |
| GET/POST | `/api/review` · `/api/review/:id/resolve` | Moderation queue |
| PATCH | `/api/questions/:id` | Correct a question; it is re-embedded (moderator) |

## Running the client

```bash
npm run seed -w client
npm run dev:client      # http://localhost:3000
```
