# MSRIT Notes Hub

A searchable archive of previous year question papers, notes and syllabus schemes for
Ramaiah Institute of Technology. Unlike a folder of Drive links, it indexes the **text of
every question**, which is what makes topic search, plain-English filters and syllabus
change tracking possible.

## Running it

```bash
npm install
npm run seed     # builds data/msrit.db from scripts/seed-data.mjs
npm run dev      # http://localhost:3000
```

Node 22+ is required (the database uses the built-in `node:sqlite` module, so there is no
native build step). Re-running `npm run seed` drops and rebuilds the database.

## Connecting the backend

The frontend reads all data through [`src/lib/data.ts`](src/lib/data.ts). Without
configuration it uses the bundled SQLite database. To use the team backend instead:

```bash
npm run check:backend                       # with BACKEND_URL set: checks every endpoint
echo "BACKEND_URL=http://localhost:5000/api" > .env.local
npm run dev                                 # /api/health shows which source is live
```

The endpoints and response shapes are in [docs/BACKEND_CONTRACT.md](docs/BACKEND_CONTRACT.md).
`/api/v1/*` in this app is a working reference implementation of that contract.

## Stack

| Layer     | Choice                                                        |
| --------- | ------------------------------------------------------------- |
| Framework | Next.js (App Router) + React + TypeScript                     |
| Database  | SQLite via `node:sqlite` — real schema, foreign keys, indexes  |
| Search    | In-process BM25F index built from the database at startup      |
| Styling   | Plain CSS with design tokens in `src/app/globals.css`          |
| Assistant | Retrieval over the same index; optional Claude API for wording |

## How search works

`src/lib/search.ts` runs four stages:

1. **Query parsing** — pulls structure out of the sentence before matching anything:
   relative year ranges (`last 3 years`), absolute ranges, course codes (`CS501`), course
   names and abbreviations (`Operating Systems`, `OS`, `DBMS`), department names and mark
   thresholds (`10 marks`). These become real filters; what remains is the topic.
2. **Query expansion** — topic terms are expanded by a curated concept map plus term
   co-occurrence statistics mined from the corpus' own topic tags, scored by pointwise
   mutual information. Expanded terms carry lower weight than what the student typed, so
   `multithreading` reaches a question that only says `thread` without drowning out exact
   matches.
3. **Ranking** — BM25 over weighted fields (topic tags and course codes outweigh body
   text), with a small recency preference.
4. **Termless fallback** — a query like *"what should I revise first for OS"* leaves a
   filter but no topic. Those are ranked by how often each question's topics recur across
   the filtered set, since repetition across papers is the real exam-prep signal.

No embedding model or external API is needed for search. Swapping in vector embeddings
later means replacing stages 2–3 behind the same `searchQuestions()` signature.

## The study assistant

`src/lib/chat.ts` runs the same retrieval, then answers. With no API key configured it
composes the answer directly from the retrieved rows — for syllabus questions that is a
structural diff, which is more accurate than anything a model would write. Set
`ANTHROPIC_API_KEY` to have Claude phrase the answer from the same retrieved context
instead; it is instructed to use nothing else, and the code falls back to the local answer
on any API error.

```bash
# optional, in .env.local
ANTHROPIC_API_KEY=sk-ant-...
```

## API

| Method | Endpoint                        | Returns                                    |
| ------ | ------------------------------- | ------------------------------------------ |
| GET    | `/api/search?q=…&limit=20`      | Ranked hits plus the parsed interpretation |
| GET    | `/api/departments`              | Departments with coverage counts           |
| GET    | `/api/departments?code=CSE`     | Courses in one department                  |
| GET    | `/api/syllabus`                 | Courses with two or more tracked schemes   |
| GET    | `/api/syllabus?course=CS501`    | Structural diff of the two latest schemes  |
| GET    | `/api/stats`                    | Archive totals and indexed year range      |
| POST   | `/api/chat`                     | Grounded answer; body `{ "question": … }`  |

## Layout

```
data/msrit.db          generated SQLite database
scripts/seed-data.mjs  the dataset
scripts/seed.mjs       schema + loader
src/lib/db.ts          queries and the syllabus diff
src/lib/search.ts      parsing, expansion, BM25 ranking
src/lib/chat.ts        retrieval-augmented answering
src/app/api/*          REST endpoints
src/app/*              pages
design/                the original design canvas artboards
```

## On the current data

The papers in `scripts/seed-data.mjs` are realistic development samples written to
exercise the system — not scans of real MSRIT papers. Course codes, question wording and
counts are invented. Replacing them with digitised originals is the next step and requires
no change to the pipeline: the seed script is the only thing that needs to point at real
data.
