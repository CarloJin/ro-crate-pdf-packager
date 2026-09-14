# Actual browser export check — 2026-09-15

Commands and repository paths below are relative to the project root unless absolute.

Focused inspection, not full conformance validation.

Command:

```powershell
node scripts/verify-export.mjs 'D:/Coding/ro-crate-packaging-tool/supplied_files' 'D:/Coding/ro-crate-packaging-tool/ro-crate-pdf-packager/output-files'
```

Checked actual crate `ro-crate-140f2f76-3032-41da-a661-7d824b44b391`.

- PASS: RO-Crate 1.3 context, CreativeWork metadata descriptor, `about`, `conformsTo` and root Dataset.
- PASS: all eight `hasPart` references resolve to the eight File entities. No author references occur in this export, so author linkage is unexercised.
- PASS: collection name, description and licence contain `Sample`; publication date is `2026-09-15`. Eight file titles are present. Empty optional file descriptions, publication dates and authors are omitted.
- PASS: each File ID resolves to a copied PDF, including the percent-encoded filename containing spaces.
- PASS: source and copied PDFs have identical relative filenames, counts (8 each) and SHA-256 hashes.
- Corrections: none needed; source, export and application code were not modified.

The browser's original review state is unavailable: the values above are confirmed present in the export, but exact agreement with user-entered values and the licence-review checkbox cannot be independently verified. Nested same-name files, nonempty authors and edited optional descriptions/dates are absent from this actual dataset. Picker/permission/error flows were not tested.

Machine-readable values and both hashes for every PDF: `.setup-check/export-verification.json`.
