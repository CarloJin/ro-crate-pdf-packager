# Minimum workflow checks — 2026-09-15

Commands and repository paths below are relative to the project root unless absolute.

Implemented the minimum SPEC.md workflow with native directory handles. No additional dependencies or stretch goals.

## Results

- PASS: `npm test` — five focused tests: RO-Crate 1.3 graph/references; reviewed fields and omitted optional blanks; required collection fields, licence confirmation and failed-PDF confirmation; recursive discovery and nested same-name files; original byte preservation using directory-handle doubles; rejected and partial writes.
- PASS: `npm run build` — production application and separate PDF worker emitted. Vite reports a non-blocking bundle-size warning.
- PASS: `npm run check:setup` — Chrome 152, real browser worker, actual `pdf-metadata.js`, all eight supplied PDFs and a malformed PDF. Raw results: `.setup-check/result.json`. Missing titles/authors/descriptions remained empty in extraction; creation dates were kept separate from publication dates.
- Original `File` references are retained on records and written directly; editable fields are held in a separate metadata object. Input handlers update the selected record before switching files.
- No unresolved implementation blockers. Node's test subprocess and headless Chrome required sandbox execution permission.

## Browser handoff

Start from the project directory:

```sh
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Open http://127.0.0.1:5173 in desktop Chrome or Edge.

1. Select `D:\Coding\ro-crate-packaging-tool\supplied_files`. Confirm eight PDF rows and extraction statuses.
2. Edit a file title/authors/description, select another PDF, then return and confirm the edits remain.
3. Complete collection name, description, publication date and your licence statement. Explicitly check the licence review box; changing the licence resets it.
4. Select an output directory and export. Inspect the new `ro-crate-<uuid>` folder: manifest plus unchanged PDFs under `files/`.
5. Optionally use a small local fixture folder with nested same-name PDFs and a malformed `.pdf`: confirm failed files remain editable and require inclusion confirmation, or can be excluded.

Not yet verified interactively: native folder pickers/cancellation, actual permission denial, user edit persistence in the rendered UI, real-directory output byte comparison and OS write failures. Automated filesystem checks use test doubles. No full browser workflow or dedicated RO-Crate validation has been claimed.

Directory read/write APIs were checked against [Chrome's official documentation](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access); PDF loading and metadata APIs against [PDF.js documentation](https://mozilla.github.io/pdf.js/api/draft/api.js.html) and installed package source/types.
