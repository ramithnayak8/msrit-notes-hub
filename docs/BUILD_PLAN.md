# Build plan: submission-ready by Sat 7 Nov 2026

Course 24CIE554 Full Stack Development. The complete project submission is due **Tue 10 Nov**
(working project, source code, documentation draft, deployment, an AI assistant integrated with
the app's data, a data analytics dashboard with filters, and a demo of the AI giving insights from
the analytics). Our target is to finish by **Sat 7 Nov**, leaving Sun 8 and Mon 9 as buffer.

Long-term goal: a deployed site that MSRIT students actually use, starting with CSE-AIML
semesters 3 to 6 (2022 to 2025 papers), at close to zero cost. Planned capacity is about 500
concurrent users and 20 searches per second, which is 2 to 3 times the expected exam-week peak
for ~6,000 students.

## Hosting (free tiers)

| Piece | Where |
| ----- | ----- |
| Frontend (Next.js) | Vercel |
| Database, Atlas Search, Vector Search | MongoDB Atlas M0 |
| Paper PDFs | Cloudflare R2 |
| API server | Oracle Cloud Always Free (fallback: Render free) |
| Verification email | Brevo |
| AI answers | Gemini free API key |

Paper ingestion runs locally (Claude Code headless with Haiku) against the Atlas database; the
deployed server only serves search and the API (`RUN_WORKER=false`).

## Day by day

### Sun 1 Nov: kickoff
- Push the unpushed commit; start the exam-insights page.
- Create the Atlas, Vercel, Cloudflare and Brevo accounts; choose the server host; get a Gemini key.
- Teammate starts sourcing papers. First batch and the four scheme PDFs needed by Wed.

### Mon 2 Nov: exam-insights page (`/analytics`)
- Filters: semester, course, year range, exam type, kept in the URL so views can be shared.
- KPI tiles: papers, questions, topics, years covered.
- Charts (plain SVG): questions per year, top topics, marks by unit, CIE vs SEE.
- Table of questions that repeat across years.
- **Done when:** every filter updates every chart, and the page works on a phone.

### Tue 3 Nov: AI layer
- Gemini answers using only the retrieved questions and analytics, with citations.
- "Ask AI about this view" button on the insights page passes the current filters.
- `ASSISTANT_LLM` flag, per-user daily cap, answers cached in Mongo, falls back to the
  retrieval-only answer when the quota runs out.
- **Done when:** filter to DAA 2022 to 2025, ask "what should I revise?", get a cited answer.

### Wed 4 Nov: deployment code
- Original PDFs move from GridFS to R2.
- Past-papers library moves from the client's SQLite file into Mongo; `/dashboard` is hidden or
  folded into the main sign-in.
- Server Dockerfile, production env template, worker off on the server.
- Cache for popular searches; rate limits tuned for exam week.
- Ingest the first batch of papers locally.

### Thu 5 Nov: go live
- Atlas: create search indexes, seed courses, point local ingestion at it.
- Deploy the server, then the client on Vercel (`/api` is proxied, so cookies stay same-origin).
- Brevo for verification email; smoke-test every page on the live URL.
- **Done when:** a classmate can register with an `@msrit.edu` address and search from a phone.

### Fri 6 Nov: data and hardening
- Ingest the remaining papers; clear the moderation review queue.
- Scheme JSONs for semesters 3 to 6 so each course links to its papers.
- Load test the live site; fix what it shows.
- Diagram questions, small version: flag questions that refer to a figure ("shown below",
  "Fig.", image or vector drawing in the question's region) with an "Includes diagram" badge;
  tag questions that ask for one ("draw", "sketch", "neat diagram") as a filter and analytics
  stat; "View on page N" link to the original PDF.

### Sat 7 Nov: wrap-up
- Documentation draft: README, architecture diagram, API reference.
- Demo script for the AI + analytics walkthrough; screenshots for the report.
- Soft launch to the CSE-AIML class.

## If we fall behind, cut in this order
1. Load test (use the capacity estimate instead).
2. Diagram flags and tags (keep only the "View on page N" link).
3. R2 (link to the original Drive URLs instead of hosting the PDFs).
4. `/dashboard` merge (hide it instead).

The insights page, the AI layer and deployment are not cut: they are graded or core to the goal.

**Main risk:** papers arriving late. If they are not in by Wed, we ship on the 16 sample papers
and add more after 10 Nov.

## After submission
- Diagram questions, full version: at ingestion, render each question's region of the page to
  an image (stored in R2) and show it under the result; during local ingestion, have the model
  write a one-line description of the figure and add it to the question's searchable text.
- 17 Nov: report review (system design, implementation, results and screenshots).
- 30 Nov: final ZIP, report and PPT.
