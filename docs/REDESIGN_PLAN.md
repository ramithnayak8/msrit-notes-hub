# Redesign plan: "The Classic Study Sanctuary"

Branch: `ui-revamp`. This is a visual and experience upgrade. The search engine, database,
syllabus diff and assistant logic are unchanged.

## 1. Audit (before)

### Stack

| Concern          | Today                                                                 |
| ---------------- | --------------------------------------------------------------------- |
| Framework        | Next.js 15 App Router, React 19, TypeScript (strict)                  |
| Routing          | File-based. Most pages are server components that call SQLite directly |
| Styling          | One global stylesheet (`src/app/globals.css`, 440 lines), tokens as CSS variables, many inline `style` props |
| State            | Local `useState` in the two client pages (search, assistant). No global state |
| Data             | `node:sqlite` read at request time; REST endpoints under `/api/*`      |
| Auth             | None. Every page is public                                            |
| Build / packages | `next build`, npm                                                     |
| Lint             | `next lint` script exists but no ESLint config, so it cannot run      |
| Tests            | None                                                                  |

### Pages and flows

| Route                 | What it does                                                        |
| --------------------- | ------------------------------------------------------------------- |
| `/`                   | Hero + search, stats, features, live worked example, syllabus diff preview, branch cards, assistant CTA |
| `/search?q=`          | Client page: fetches `/api/search`, shows parsed interpretation, results, year/topic/expansion sidebar |
| `/departments`        | Table of 9 branches with coverage and status                        |
| `/departments/[code]` | Branch stats, then one table of courses per semester                |
| `/courses/[code]`     | Every paper's questions, sidebar with counts, top topics, notes      |
| `/syllabus?course=`   | Course chips, structural diff (added/removed), current scheme        |
| `/assistant?q=`       | Chat UI over `/api/chat`, suggested prompts, cited sources          |
| `/about`              | Architecture notes, API table, contribution guide                   |

Data volume: 9 branches, 21 courses, 56 papers, 146 questions, 20 note sets.
There are no PDF downloads or video materials in the data model. "Material" here means
papers (with their questions), note sets and syllabus schemes.

### Baseline numbers (production build, `next start`)

- First Load JS: 103 kB shared, 104 to 107 kB per route.
- Lighthouse mobile, home page: Performance 95, Accessibility 95, Best Practices 96, SEO 100
  (FCP 1.8 s, LCP 2.5 s, TBT 100 ms, CLS 0).

### Pain points

1. **No navigation on phones.** Under 680 px the nav links are hidden with nothing in their
   place. The only way around is the "Search the archive" button.
2. **Reaching material is table-heavy.** Branch and semester pages are dense data tables.
   They work, but nothing invites browsing.
3. **No memory.** No bookmarks, no recently viewed, no way to come back to a question.
4. **Flat, clinical first impression.** It reads as a well-built tool, not as a place to study.
5. **Missing states.** No custom 404, no error boundary, no route loading states. Search shows
   a bare spinner and blanks previous results while loading.
6. **Meta and sharing.** One global title, no Open Graph, no favicon (the 404 in the console).
7. **Inline styles everywhere.** Spacing and layout are repeated as inline objects, which makes
   theming harder.

## 2. Design direction

**Concept: a floating library at night.** Hero concept (a) from the brief: books drift
slowly through warm shafts of window light with dust in the air. It matches the existing
scholarly tone and gives the strongest "sit down and study" signal.

### Tokens

All in `src/styles/tokens.css` as CSS variables, redefined per theme on `[data-theme]`.
Existing token names (`--ink`, `--surface`, `--accent`, ...) are kept so every page that
references them restyles automatically.

| Role        | Dark "Night library" (default) | Light "Parchment"   | Sepia "Reading"    |
| ----------- | ------------------------------ | ------------------- | ------------------ |
| Background  | deep navy                      | parchment cream     | warm sepia         |
| Ink         | parchment cream                | navy                | dark brown         |
| Accent      | warm gold                      | bronze              | rust               |

Typography: **Cormorant Garamond** for display headings, **Inter** for UI, **Source Serif 4**
kept for question text and long reading (Cormorant is too thin for body copy, so it is used
only at 24 px and above), **IBM Plex Mono** for codes.

## 3. Architecture

```
src/styles/        tokens, base, components, feature styles (imported by globals.css)
src/components/
  layout/          Masthead, MobileMenu, Footer
  hero/            Hero, HeroCanvas (lazy loader), CSS fallback, intro loader
  hero/library/    react-three-fiber scene: books, pages, light shafts, dust, camera rig
  ambience/        scene registry, ambience layer, 2D particle engine, SVG layers, Web Audio
  study/           StudyRoom provider, settings panel, Focus Mode, command palette, shelf
  ui/              TiltCard, Magnetic, Counter, Bookshelf, Skeleton, CursorHalo, SmoothScroll
src/lib/client/    storage, fuzzy match, device capability, streak maths
```

### New dependencies

| Package                        | Why                                                        |
| ------------------------------ | ---------------------------------------------------------- |
| `three`                        | WebGL renderer for the hero                                |
| `@react-three/fiber`           | Declarative three.js in React; handles disposal on unmount |
| `@react-three/postprocessing`  | Bloom and vignette (desktop only)                          |
| `lenis`                        | Smooth scrolling (~4 kB gz)                                |
| `@types/three` (dev)           | Types                                                      |
| `eslint`, `eslint-config-next` (dev) | Makes the existing `npm run lint` script actually run |

The 3D packages load in a separate lazy chunk, never in the initial bundle.

## 4. Compromises (and why)

| Brief asks for                         | Decision                                                   |
| -------------------------------------- | ---------------------------------------------------------- |
| GSAP ScrollTrigger for scroll-linked camera | Not added. The camera reads scroll progress inside the render loop. Same effect, no extra 45 kB, no second animation runtime |
| Framer Motion or GSAP page transitions | A `template.tsx` with CSS enter animations. Zero JS, respects reduced motion |
| Depth of field                         | Faked with fog and depth-scaled, softer dust near the camera. Real DoF is too expensive on phones for a decorative layer |
| Photo/video wallpapers                 | All 6 scenes are procedural (SVG + canvas). No licensing risk, tiny payload. `docs/CREDITS.md` records this |
| Ambient audio (rain, library, lo-fi)   | Procedural Web Audio (filtered noise, chimes, crickets). No audio files. Lo-fi music is out of scope |
| Custom cursor                          | The native cursor stays (so text inputs keep the I-beam). A gold halo follows it and grows over interactive elements. Desktop pointers only |
| Fuzzy search library                   | A small in-house fuzzy scorer. The catalogue is 30 items; a library is not worth the bytes |
| Bookmarks / streak "existing backend if auth exists" | There is no auth, so this uses localStorage |
| 3D on phones                           | A lighter profile (fewer books, no post-processing, DPR 1.5) that loads on the first touch or scroll, so it never competes with first paint |

### One backend addition

`GET /api/catalog`: read-only, returns branches and courses for the command palette. It
reuses the existing `getDepartments()` and `getAllCourses()` queries. Nothing existing changes.

## 5. Phases

1. Audit + plan (this file)
2. Design system: tokens, three themes with no flash on load, type, base components, mobile menu
3. Hero: 3D library scene, CSS fallback, intro loader, capability detection
4. Navigation and browsing: bookshelf branches, course books, course page sections, command
   palette, search skeletons, 404/error/loading states
5. Ambience switcher (6 scenes + audio) and Focus Mode (Pomodoro), My Shelf, streaks
6. Micro-interactions: tilt, magnetic buttons, cursor halo, counters, page transitions, Lenis
7. Performance, accessibility and responsive pass
8. Final QA

## 6. Changelog

_Filled in as phases land._
