# PDF.js compatibility fix — 2026-09-15

Commands and repository paths below are relative to the project root unless absolute.

## Confirmed cause

The reported error was reproduced with PDF.js 6.3.289 by deleting `Map.prototype.getOrInsertComputed` in a headless Chrome test page. The captured stack is in `.setup-check/compatibility-before.json`:

`WorkerTransport.getMetadata` → `PDFDocumentProxy.getMetadata` → test metadata request.

The original installed `build/pdf.mjs:16983` directly called `this.#methodPromises.getOrInsertComputed`; that private field is a native Map (line 16430). Thus the reported failure is a missing JavaScript runtime API, not absent PDF metadata. No complete stack or version from the user's affected browser was supplied; the local reproduction matches the exact reported exception.

[MDN documents this newer Map API and its compatibility](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/getOrInsertComputed). The selected [PDF.js 5.4.624 release](https://github.com/mozilla/pdf.js/releases/tag/v5.4.624) and its [metadata implementation](https://raw.githubusercontent.com/mozilla/pdf.js/v5.4.624/src/display/api.js) use the older Map operations for this path.

## Small fix

Pinned `pdfjs-dist` to exactly `5.4.624` in package.json and regenerated package-lock.json. The existing main and worker imports resolve to the same installed package. No application, architecture, RO-Crate or SPEC.md changes; no production polyfill. Lockfile changes include the selected PDF.js release's optional transitive dependencies.

## Verification

- PASS: reproduced original exception before downgrade; the matching stack was recorded.
- PASS: the same missing-Map-API regression runs with 5.4.624; raw evidence is `.setup-check/compatibility-after.json`.
- PASS: real PDF.js Worker (`worker.port instanceof Worker`), PDF text, fixture title and author extraction.
- PASS: all eight supplied PDFs parse and remain listed in the actual app UI, with extraction statuses. Available creation dates are extracted separately from publication dates. Missing descriptive metadata remains blank, without failure warnings; author edits persist across file selection.
- PASS: malformed PDF still reports an extraction failure.
- PASS: package.json dependencies and devDependencies agree with lockfile root; installed PDF.js agrees with its lockfile version. Main and worker source headers both identify 5.4.624, and neither source contains `getOrInsertComputed`.
- PASS: `npm run build`; separate worker emitted. Existing non-blocking bundle-size warning remains.

The compatibility simulation disables this Map method in the page, including the application iframe; it does not emulate an entire older browser. Worker execution uses installed Chrome 152. UI automation substitutes the folder picker with handles backed by the supplied PDF Files, and exercises the real listing/extraction/edit handlers.

## Manual check

Restart the dev server and hard-refresh the affected browser so it loads the new dependency bundle. Select the supplied folder; confirm eight extracted entries, editable blanks and saved edits when switching files. Actual affected-browser compatibility, native permission dialogs and a real-directory export still require manual verification.

Repeat the compatibility check in PowerShell:

```powershell
$env:COMPAT_CHECK = '1'
$env:CHECK_RESULT = '.setup-check/compatibility-after.json'
npm run check:setup
```
