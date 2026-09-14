# PDF to RO-Crate

A small browser app for reviewing PDF metadata and exporting an RO-Crate 1.3 with unchanged PDFs. See [SPEC.md](SPEC.md) for the required scope.

## Requirements and commands

Use desktop Chrome or Edge on localhost or HTTPS with the File System Access API enabled. Node is used only for development and checks; Node 24.16.0 and npm 11.13.0 were used here. PDF.js is pinned to 5.4.624 so metadata extraction does not depend on `Map.getOrInsertComputed`; the main module and worker come from the same package.

From this directory:

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Open http://127.0.0.1:5173. Other commands match the scripts in package.json:

```sh
npm run build
npm test
npm run check:setup
```

`build` creates `dist/`; `test` runs focused Node tests. `check:setup` runs the browser harness and expects Windows Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe`, the supplied PDFs at `../supplied_files`, and available localhost ports 5179/9239. It requires permission to launch a browser and server.

To inspect actual exports without the browser harness:

```sh
node scripts/verify-export.mjs ../supplied_files ./output-files
```

## Workflow

1. Select a source folder. PDFs in subfolders are listed with extraction status; other files are ignored.
2. Complete collection name, description, publication date and licence statement, then explicitly confirm licence review.
3. Review file titles, authors (one per line), descriptions and optional publication dates. Filename fallback titles are labelled; extracted creation dates are separate. Missing metadata stays editable. Failed PDFs require confirmation before inclusion or can be excluded.
4. Select an output directory and export. A new `ro-crate-<uuid>` folder contains `ro-crate-metadata.json` and unchanged PDFs under `files/`.

Edits persist when switching files, but not after reloading or replacing the source folder. File processing runs locally in the browser, and original File objects are retained for export.

## Included sample and verified results

The actual browser-exported sample is [output-files/ro-crate-140f2f76-3032-41da-a661-7d824b44b391](output-files/ro-crate-140f2f76-3032-41da-a661-7d824b44b391/), including its manifest and eight PDFs. Collection name, description and licence contain `Sample`, with publication date `2026-09-15`; these are sample values, not a licence recommendation.

- Production build and five focused Node tests passed.
- Browser checks passed for a real PDF.js worker, all eight supplied PDFs, missing metadata, malformed-PDF handling and edit persistence. The compatibility regression also passed with the newer Map API unavailable.
- The actual crate passed focused checks for RO-Crate 1.3 structure, all eight `hasPart` references, copied file paths, omitted blank optional fields and matching source/output SHA-256 hashes.

Details: [EXPORT-CHECK.md](docs/EXPORT-CHECK.md), [PDF-COMPATIBILITY-CHECK.md](docs/PDF-COMPATIBILITY-CHECK.md), and [WORKFLOW-CHECKS.md](docs/WORKFLOW-CHECKS.md). Earlier setup results remain in [SETUP-CHECK.md](docs/SETUP-CHECK.md); the compatibility report records the subsequent PDF.js version change. Machine-readable evidence and the browser harness are retained in `.setup-check/`.

## Limitations and deliverables

These are focused checks, not full conformance validation. The actual sample has no author references or nested same-name files, so those cases were not exercised by that export. Exact agreement with original browser review inputs is unverified. Native cancellation/permission dialogs, OS write failures and the affected browser after the compatibility fix still require manual verification; automated UI checks substitute the folder picker.

Keep source, documentation, lockfile, tests and sample output in the handoff. Exclude `node_modules/`, generated `dist/`, browser profiles, local secrets and temporary files using `.gitignore`. A Git archive also excludes the local Git metadata; when copying the working folder manually, honour the same exclusions. Verification scripts and recorded evidence in `.setup-check/` are intentional deliverables.
