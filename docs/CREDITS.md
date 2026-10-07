# Credits and asset sources

ConceptQuery ships no third-party images, video or audio.

## Past papers library

The `/papers` library links to past papers that MSRIT students share on two student-run archives.
Only file names and Google Drive links are collected (`npm run crawl`); no file is downloaded,
copied or re-hosted, and every entry credits its source.

| Source | Run by | Link |
| ------ | ------ | ---- |
| RIT Notebook | MSRIT students (labcodesandnotes@gmail.com) | https://ritnotebook.netlify.app |
| RIT ISE | Mohit Nair and contributors (riserit@proton.me) | https://riserit.vercel.app ([source](https://github.com/themohitnair/rise)) |

The files belong to the students who uploaded them. To have a file unlisted, open an issue and it
will be excluded from the next crawl.

## Assets

| What                     | Source                                                            |
| ------------------------ | ----------------------------------------------------------------- |
| Hero 3D library          | Procedural geometry and shaders (three.js, react-three-fiber)      |
| Ambience scenes          | Procedural: CSS gradients and a 2D canvas particle field          |
| Ambient sound            | Generated live with the Web Audio API (noise, oscillators)        |
| Icons                    | Hand-written inline SVG paths in `src/components/ui/Icon.tsx`     |
| Fonts                    | Cormorant Garamond, Inter, Source Serif 4, IBM Plex Mono via Google Fonts (SIL Open Font License) |
| Smooth scrolling         | Lenis (MIT)                                                       |
