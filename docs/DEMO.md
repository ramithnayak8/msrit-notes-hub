# Demo runbook (24CIE554)

## Start everything (one terminal, repo root)

```bash
npm run demo                # MongoDB + API (:4000) + site (:3000), production mode
npm run demo -- --no-build  # same, without rebuilding (faster restart)
```

Open http://localhost:3000 when it prints `✓ Ready`. Ctrl+C stops both servers.
Ports 3000 and 4000 must be free (close any `npm run dev:*` terminals first).

`server/.env` needs `CLIENT_ORIGIN=http://localhost:3000`. The demo runs fully offline with
`ASSISTANT_LLM=false`: the assistant answers instantly from retrieval (hybrid search + topic
statistics, with citations). Ollama (`OLLAMA_MODEL`) still tags topics on uploaded papers in the
background. For model-written answers, set `ASSISTANT_LLM=true` with a hosted key
(`GEMINI_API_KEY` / `ANTHROPIC_API_KEY` / `GROQ_API_KEY`); the local model alone needs ~2 min per answer on a CPU.

For development with hot reload instead: `npm run dev:server` and `npm run dev:client`.

## Accounts

| Role | Email | Password |
| ---- | ----- | -------- |
| Moderator (upload, dashboard, delete) | moderator@msrit.edu | Demo@12345 |
| Student | student@msrit.edu | Demo@12345 |

New registrations need an `@msrit.edu` address; without SMTP the verification link is printed
in the API terminal (`SMTP not configured; verification link`).

## Walkthrough, mapped to the requirements

| Requirement | Show |
| ----------- | ---- |
| Frontend: pages, navigation, forms, validation | Home → Search → Exam insights → Assistant → Papers. On `/login`, try a non-msrit email or a 3-character password: rejected in the browser and by the API (Zod). |
| Auth & authorization | Sign in as the student: no Upload/Dashboard. Sign in as the moderator: both appear. A student calling a moderator API gets 403. JWT access token + rotating httpOnly refresh cookie, argon2id passwords. |
| CRUD | Moderator: upload a PDF on `/upload` (create) → watch it process; `/dashboard`: review queue, approve/rename topics, change a user's role (update), delete a paper (delete). |
| Database | MongoDB: papers in GridFS, questions with 384-d embeddings, Atlas Search + Vector Search indexes. |
| Data analytics + filters | `/analytics`: filter by semester, course, year range, exam type (kept in the URL). KPI tiles, questions per year, top topics, marks by unit, CIE vs SEE, repeated questions table. |
| AI integrated with app data | `/assistant`, signed in: "What should I revise for Software Engineering?" ranks the course's topics by how many papers examined them, citing papers. AI in the pipeline: a local embedding model (bge-small) powers semantic search, and a local LLM (Ollama) tags each uploaded paper's questions with topics. |
| AI + analytics together | On `/analytics`, filter to Software Engineering, 2023–2024, then **Ask about this view**: the assistant receives exactly that filtered slice and explains it. |
| Search | `/search`: "agile vs waterfall", "big data 10 marks questions from 2024": hybrid BM25 + vector search with filters read from the sentence. |

## Data

41 past papers (CSE-AIML semester 5 and related branches: Big Data, Software Engineering,
RM & IPR, Environmental Studies, Full Stack) ingested with
`npm run import:papers -w server -- <folder>`; course, year and exam type come from each
paper's header and, where the header was unreadable, from the file name.
