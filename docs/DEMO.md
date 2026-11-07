# Demo runbook (24CIE554)

## Start everything (4 terminals, repo root)

```bash
docker start conceptquery-mongo   # or: npm run db:up   (MongoDB + Atlas Search/Vector Search)
ollama serve                      # skip if the Ollama tray app is running; model: qwen2.5:3b
npm run dev:server                # API on http://localhost:4000
npm run dev -w client -- -p 3001  # site on http://localhost:3001 (3000 if it's free; then set CLIENT_ORIGIN back)
```

`server/.env` needs `CLIENT_ORIGIN=http://localhost:3001` when the site runs on 3001, and
`OLLAMA_MODEL=qwen2.5:3b` (or a `GEMINI_API_KEY`, which answers in ~2 s instead of ~1 min).

Warm the model once before presenting (first answer loads it into memory):
`curl localhost:11434/api/generate -d '{"model":"qwen2.5:3b","prompt":"hi"}'`

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
| AI integrated with app data | `/assistant`, signed in: "What should I revise for Software Engineering?" The answer is written by the model from retrieved questions and topic statistics only, and cites papers. |
| AI + analytics together | On `/analytics`, filter to Software Engineering, 2023–2024, then **Ask about this view**: the assistant receives exactly that filtered slice and explains it. |
| Search | `/search`: "agile vs waterfall", "big data 10 marks questions from 2024": hybrid BM25 + vector search with filters read from the sentence. |

## Data

41 past papers (CSE-AIML semester 5 and related branches: Big Data, Software Engineering,
RM & IPR, Environmental Studies, Full Stack) ingested with
`npm run import:papers -w server -- <folder>`; course, year and exam type come from each
paper's header and, where the header was unreadable, from the file name.
