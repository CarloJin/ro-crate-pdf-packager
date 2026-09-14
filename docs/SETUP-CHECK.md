# Setup check — 2026-09-15

Commands and repository paths below are relative to the project root unless absolute.

Scope: SPEC.md environment and minimal browser integration only. Application implementation and full workflow testing are deferred.

- PASS: Windows, Node 24.16.0, npm 11.13.0; Chrome 152 headless runs on localhost. Secure context and `showDirectoryPicker` are available (picker interaction is deferred).
- PASS: Installed only direct dependencies `pdfjs-dist` 6.3.289, `ro-crate` 3.7.2 and development dependency Vite 8.3.0, plus their package dependencies. npm reported zero vulnerabilities at installation.
- PASS: A generated one-page PDF parses with a real browser Worker (`PDFWorker.port instanceof Worker`); title and page text match the fixture.
- PASS: Browser-side `ROCrate` construction, `rootDataset`, `addEntity`, `getEntity`, and `JSON.stringify` produce a root Dataset, linked File and metadata descriptor using explicit RO-Crate 1.3 identifiers.
- API finding: The installed crate library defaults to 1.2; explicitly supply the 1.3 context and descriptor `conformsTo`. PDF.js 6 cleanup uses `PDFDocumentLoadingTask.destroy()`, not `PDFDocumentProxy.destroy()`.
- Resolved check failures: sandbox npm access required elevation; excluded Chrome cache from Vite watching; registered fixture middleware before Vite's fallback; corrected PDF cleanup API. Final run exited 0; raw evidence is `.setup-check/result.json`.
- Blockers: none for implementation. Browser automation requires execution permission outside this sandbox.

Verified installed source/types against official documentation:

- [PDF.js API](https://mozilla.github.io/pdf.js/api/draft/api.js.html): `getDocument`, `getMetadata`, loading task cleanup.
- [PDFWorker](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFWorker.html): worker setup and port.
- [RO-Crate library](https://github.com/Language-Research-Technology/ro-crate-js): constructor, entities, root dataset and JSON serialisation; installed `lib/defaults.js` confirms the 1.2 default.
- [Vite assets](https://vite.dev/guide/assets.html): explicit `?url` asset import for the PDF worker.

Re-run: `npm run check:setup` (uses installed Chrome and localhost ports 5179/9239; no added browser test package).

Next action: implement `files.js`, `pdf-metadata.js`, `crate.js`, and `main.js` per SPEC.md, then run the supplied-PDF and complete workflow checks.
