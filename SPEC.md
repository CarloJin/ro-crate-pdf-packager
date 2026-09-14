# PDF to RO-Crate

## Goal and approach

Build a small browser app that packages the supplied PDFs into an RO-Crate 1.3 after metadata review.

Use JavaScript, Vite, plain HTML, `pdfjs-dist` and the `ro-crate` npm library. All file processing runs in the browser; Node is only for development, builds and tests. Target desktop Chrome/Edge on localhost or HTTPS, using the File System Access API. Check browser support and installed library APIs before implementation.

## Workflow and metadata

1. Select a source folder, include PDFs in subfolders and list their relative paths. Ignore other files.
2. Extract available medatada including embedded titles, authors, descriptions and creation dates. Show missing fields as blanks and label filename-based fallback titles.
3. Allow collection and file metadata to be reviewed and edited. Preserve edits when switching files.
4. Select an output directory and create a new crate subfolder there. Copy the original PDFs and write the reviewed metadata.

Collection fields are name, description, publication date and license statement; require these before export without assuming an open license. File fields are title, authors, description and optional publication date. Show extracted creation dates separately, not as publication dates. User edits take priority.

PDFs without metadata remain usable. Parsing failures show per-file warnings and allow manual entry, with confirmation before inclusion. One failure must not stop other files.

## Responsibilities

* `files.js`: folder selection, recursive listing and output writes.
* `pdf-metadata.js`: PDF bytes to extracted fields and warnings.
* `crate.js`: reviewed records to RO-Crate metadata, without DOM or filesystem access; testable in Node.
* `main.js`: interface, review state and coordination.

Keep original file references separate from editable metadata.

## Output

Write `ro-crate-metadata.json` and unchanged PDFs under `files/`, preserving source-relative paths.

Include the RO-Crate 1.3 context (`https://w3id.org/ro/crate/1.3/context`), a root `Dataset` with ID `./`, and one `File` per included PDF linked through `hasPart`. The `CreativeWork` descriptor has ID `ro-crate-metadata.json`, `about` referencing `./`, and `conformsTo` referencing `https://w3id.org/ro/crate/1.3`.

Map reviewed titles to `name`, publication dates to `datePublished`, and authors to linked `Person` entities. Include collection description and license. File URI IDs must resolve to the copied paths, including special characters. Omit empty optional fields.

## Checks and scope

Verify the supplied PDFs, missing metadata, persisted edits, crate structure and references, nested same-name files, and unchanged output PDF bytes. Handle empty folders, picker cancellation, denied permissions and write errors clearly. Never overwrite existing output or report partial export as success.

Complete the minimum workflow. Checksums, ORCID, dedicated validation and static previews are optional. OCR, plugins and profiles are outside scope. Update this specification before implementing changed design decisions; record actual test results separately.
