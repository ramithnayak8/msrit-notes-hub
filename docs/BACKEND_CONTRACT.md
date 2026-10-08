# Backend API contract

What the ConceptQuery frontend needs from the team backend. Build these endpoints and the
frontend connects by setting one environment variable; no frontend code changes.

```
BACKEND_URL=http://localhost:5000/api   # your base URL, including any prefix, no trailing slash
```

All frontend calls go through [`src/lib/data.ts`](../src/lib/data.ts). If an endpoint has to
differ from this document, change the path or mapping there; it is the only file that knows
about the backend.

## Conventions

- JSON in and out. `Content-Type: application/json`.
- Requests come from the Next.js server, not browsers, so **CORS is not needed**.
- Field names are exactly as below (mostly `snake_case`, matching the SQL columns; search and
  chat responses use `camelCase`).
- **404** with any body when a single item does not exist (`/courses/:code`, `/departments/:code`,
  `/courses/:code/syllabus/diff`). The frontend shows its "not on the shelf" page.
- Any other non-2xx status is treated as an error page. Timeout is 8 s (`BACKEND_TIMEOUT_MS`).
- Lists return `[]` when empty, never 404.
- Codes in URLs are case-insensitive (`cs501` and `CS501` are the same course).

## Check your server

```bash
BACKEND_URL=http://localhost:5000/api node scripts/check-backend.mjs
```

It calls every endpoint below and reports which ones are missing or return the wrong shape.
Once it passes, put `BACKEND_URL` in `.env.local`, restart `npm run dev`, and open
`/api/health` to confirm the site is using the backend.

## Endpoints

| # | Method and path | Returns |
| - | --------------- | ------- |
| 1 | `GET /health` | `{ "ok": true }` (any 2xx) |
| 2 | `GET /departments` | `DepartmentWithStats[]` |
| 3 | `GET /departments/:code` | `Department` or 404 |
| 4 | `GET /departments/:code/courses` | `CourseWithStats[]` |
| 5 | `GET /courses` | `Course[]` |
| 6 | `GET /courses/:code` | `Course` or 404 |
| 7 | `GET /courses/:code/papers` | `Paper[]` |
| 8 | `GET /courses/:code/questions` | `Question[]` |
| 9 | `GET /courses/:code/notes` | `Note[]` |
| 10 | `GET /courses/:code/syllabus` | `SyllabusVersion[]` |
| 11 | `GET /courses/:code/syllabus/diff` | `SyllabusDiff` or 404 (fewer than two versions) |
| 12 | `GET /courses/:code/library` | `ExternalPaper[]` |
| 13 | `GET /syllabus/courses` | `{ code, title, versions }[]` |
| 14 | `GET /syllabus/versions/:id/units` | `SyllabusUnit[]` |
| 15 | `GET /stats` | `Stats` |
| 16 | `GET /stats/years` | `{ min: number, max: number }` (paper years) |
| 17 | `GET /search?q=&limit=` | `SearchResponse` (`limit` 1–50, default 20) |
| 18 | `POST /chat` body `{ "question": string }` | `ChatReply` |
| 19 | `GET /library?q=&year=&dept=&exam=&page=` | `PaperLibrary` |
| 20 | `GET /library/stats` | `{ papers, subjects, sources }` |
| 21 | `GET /library/years` | `{ year, papers, subjects, top: string[] }[]` |
| 22 | `GET /library/subjects` | `{ subject, papers }[]` (up to 400, most papers first) |
| 23 | `GET /library/courses?codes=CS501,CS304` | `{ code, title, papers }[]` in the order given |

Ordering the frontend relies on: departments `active` first, then `growing`, then `planned`
(most questions first within each); courses by semester then code; papers and notes newest
first; syllabus versions oldest first; library entries newest first.

## Shapes

Real rows from the current dataset. TypeScript definitions are in
[`src/lib/types.ts`](../src/lib/types.ts).

```jsonc
// Department
{ "code": "CSE", "name": "Computer Science", "full_name": "Computer Science & Engineering",
  "status": "active",              // "active" | "growing" | "planned"
  "accent_from": "oklch(68% 0.19 296)", "accent_to": "oklch(66% 0.18 258)" }   // any CSS colour; spine gradient

// DepartmentWithStats = Department + counts
{ ...Department, "course_count": 7, "paper_count": 24, "question_count": 89,
  "note_count": 12, "library_count": 410 }

// Course
{ "code": "CS304", "title": "Data Structures and Applications", "dept_code": "CSE",
  "semester": 3, "credits": 4 }

// CourseWithStats = Course + counts
{ ...Course, "paper_count": 5, "question_count": 25, "note_count": 3 }

// Paper
{ "id": 1, "course_code": "CS304", "exam_type": "End Sem", "year": 2024, "month": "Jan",
  "label": "CS304 End Sem Jan 2024.pdf" }

// Question  (topics is one string, "|"-separated)
{ "id": 1, "paper_id": 1, "course_code": "CS304", "number": "5a",
  "text": "Explain the algorithm for binary tree traversal ...", "marks": 8, "unit": 3,
  "topics": "binary tree|tree traversal|recursion", "level": "Understand" }

// Note
{ "id": 1, "course_code": "CS304", "title": "Data Structures — Complete Unit-wise Notes",
  "kind": "Handwritten", "pages": 118, "contributor": "Sem 3 CSE batch", "year": 2024 }

// SyllabusVersion
{ "id": 1, "course_code": "CS501", "academic_year": "2024-25", "effective_from": "Aug 2024" }

// SyllabusUnit
{ "unit": 1, "unitTitle": "Introduction", "hours": 8, "topics": ["Process concept", "Threads"] }

// SyllabusDiff  (from = older version, to = newer)
{ "courseCode": "CS501", "courseTitle": "Operating Systems",
  "from": SyllabusVersion, "to": SyllabusVersion,
  "added":   [{ "unit": 3, "unitTitle": "Trees", "topic": "Trie data structure" }],
  "removed": [{ "unit": 3, "unitTitle": "Trees", "topic": "Threaded binary trees" }],
  "unchangedCount": 18,
  "newUnits": [{ "unit": 6, "unitTitle": "...", "hours": 6 }] }

// Stats
{ "departments": 9, "courses": 21, "papers": 56, "questions": 146, "notes": 20, "years": 7 }

// ExternalPaper  (a past paper hosted elsewhere; url opens the original file)
{ "id": 147, "source": "ritnotebook", "branch": "CSE", "dept_code": "CSE",
  "semester": null, "study_year": 2, "subject": "Data Structures", "course_code": "CS304",
  "exam_type": "CIE", "year": 2024, "month": null, "title": "2024 CIE",
  "kind": "pdf",                   // "pdf" | "image" | "doc" | "file"
  "url": "https://drive.google.com/file/d/.../view" }
```

### `GET /search` → `SearchResponse`

```jsonc
{
  "query": {
    "raw": "deadlock",
    "terms": ["deadlock"],
    "expandedTerms": [{ "term": "deadlock", "weight": 1 }, { "term": "banker", "weight": 0.45 }],
    "intent": "questions",          // "questions" | "syllabus-change" | "notes"
    "filters": {},                  // optional: yearFrom, yearTo, deptCode, courseCode, courseCodes[], minMarks
    "explanation": ["topic: deadlock"]   // chips shown under the search box
  },
  "hits": [{
    "id": 69, "courseCode": "CS501", "courseTitle": "Operating Systems", "deptCode": "CSE",
    "number": "4a", "text": "Illustrate the Banker's algorithm ...", "marks": 10, "unit": 4,
    "topics": ["deadlock", "bankers algorithm"],   // array here, unlike Question
    "level": "Apply", "examType": "End Sem", "year": 2025, "month": "Jan",
    "paperLabel": "CS501 End Sem Jan 2025.pdf",
    "score": 100,                   // 0-100, shown as "% match"
    "matchedTerms": ["deadlock"]    // highlighted in the text
  }],
  "total": 37, "tookMs": 2.64,
  "topicSummary": [{ "topic": "deadlock", "count": 8 }],
  "yearSummary": [{ "year": 2024, "count": 17 }]
}
```

If the backend does not do query expansion, return `expandedTerms` equal to `terms` with
weight 1 and an `explanation` of `["free text"]`; everything else still works.

### `POST /chat` → `ChatReply`

```jsonc
{ "answer": "Markdown text ...",
  "sources": [{ "kind": "question",            // "question" | "syllabus" | "notes"
                "label": "CS501 · End Sem Jan 2025 · Q4a",
                "detail": "Illustrate the Banker's algorithm ..." }],
  "mode": "claude",                            // "claude" | "local" (how the answer was written)
  "retrieved": 8,                              // items retrieved before answering
  "tookMs": 1840 }
```

### `GET /library` → `PaperLibrary`

Query parameters, all optional:

| Param | Meaning |
| ----- | ------- |
| `q` | Words that must all appear in subject, title, branch or course code |
| `year` | Year of study, 1–4 |
| `dept` | Department code; first-year papers (shared by a stream) are included for every branch |
| `exam` | Comma-separated exam types, e.g. `CIE,CIE 1,CIE 2,CIE 3,Quiz` |
| `page` | 1-based; 18 subject groups per page |

```jsonc
{
  "shelves": [{
    "subject": "Data Structures", "studyYear": 2, "semesters": [3],
    "courseCode": "CS304",          // or null
    "branches": ["CSE", "CSE-AIML"],
    "papers": [ExternalPaper, ...]
  }],
  "totalShelves": 441, "totalPapers": 2481, "page": 1, "pages": 25
}
```

Shelves group papers by subject and year of study, biggest first within each year.

## Not covered yet

- **Accounts.** My Shelf (bookmarks, recent courses, streaks) and the focus timer store their
  data in the browser. If the backend adds login, add `GET/PUT /me/shelf` and the frontend
  will sync to it.
- **Uploads.** No upload endpoint is used yet. Contributors are pointed to the About page.
