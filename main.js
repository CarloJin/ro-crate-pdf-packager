import { selectDirectory, listPDFs, exportCrate } from './files.js';
import { extractMetadata } from './pdf-metadata.js';
import { createCrate } from './crate.js';

const $ = id => document.getElementById(id);
const fields = ['title', 'authors', 'description', 'datePublished'];
let records = [], selected = -1, output, busy = false;
const supported = isSecureContext && typeof window.showDirectoryPicker === 'function';
const status = message => { $('status').textContent = message; };
function setBusy(value) {
  busy = value;
  for (const id of ['source', 'output', 'export']) $(id).disabled = value || !supported;
  $('collection').disabled = value;
  $('editor').disabled = value || selected < 0;
  renderList();
}
function renderList() {
  $('file-list').replaceChildren(...records.map((record, index) => {
    const li = document.createElement('li'), button = document.createElement('button');
    button.type = 'button'; button.disabled = busy;
    button.textContent = `${record.path} — ${record.status}${record.include ? '' : ' (excluded)'}`;
    button.setAttribute('aria-current', String(index === selected));
    button.onclick = () => showFile(index);
    li.append(button); return li;
  }));
  $('count').textContent = `${records.length} PDFs; ${records.filter(r => r.include).length} included.`;
}
function showFile(index) {
  selected = index;
  const record = records[index];
  $('editor').disabled = busy || !record;
  if (!record) return;
  $('file-path').textContent = record.path;
  for (const field of fields) $('file-' + field).value = record.metadata[field];
  $('include').checked = record.include;
  $('file-warning').textContent = record.warning;
  $('title-origin').textContent = record.fallbackTitle ? 'Filename-based fallback title — editable.' : '';
  $('creation-date').textContent = record.creationDate;
  $('failure-label').hidden = !record.failed;
  $('failure-confirmed').checked = record.failureConfirmed;
  renderList();
}
for (const field of fields) $('file-' + field).addEventListener('input', event => {
  const record = records[selected];
  record.metadata[field] = event.target.value;
  if (field === 'title') { record.fallbackTitle = false; $('title-origin').textContent = ''; }
});
$('include').onchange = event => { records[selected].include = event.target.checked; renderList(); };
$('failure-confirmed').onchange = event => { records[selected].failureConfirmed = event.target.checked; };
$('collection-license').oninput = () => { $('license-reviewed').checked = false; };
function reportError(error) {
  status(error.name === 'AbortError' ? 'Folder selection cancelled. Your current review is unchanged.' : `${error.name === 'NotAllowedError' ? 'Permission denied. ' : ''}${error.message}`);
}
$('source').onclick = async () => {
  if (records.length && !confirm('Selecting another source replaces file metadata edits. Continue?')) return;
  setBusy(true);
  try {
    const directory = await selectDirectory('read');
    status('Listing PDFs…');
    const originals = await listPDFs(directory);
    records = originals.map(original => ({ ...original, metadata: { title: '', authors: '', description: '', datePublished: '' }, include: true, failureConfirmed: false, status: 'Waiting', warning: '', creationDate: '' }));
    selected = -1;
    $('source-name').textContent = ` ${directory.name}`;
    renderList();
    for (const [index, record] of records.entries()) {
      status(`Extracting ${index + 1}/${records.length}: ${record.path}`);
      let extraction;
      try {
        if (!record.file) throw new Error(record.readError);
        extraction = await extractMetadata(await record.file.arrayBuffer());
      } catch (error) { extraction = { failed: true, warning: `Cannot read PDF: ${error.message}. Exclude it or select the source again.`, metadata: record.metadata, creationDate: '' }; }
      Object.assign(record, extraction);
      if (!record.metadata.title) { record.metadata.title = record.path.split('/').at(-1).replace(/\.pdf$/i, ''); record.fallbackTitle = true; }
      record.status = record.failed ? 'Extraction failed' : record.fallbackTitle ? 'Extracted; filename title' : 'Extracted';
      renderList();
    }
    if (records.length) showFile(0);
    else { $('file-path').textContent = ''; for (const field of fields) $('file-' + field).value = ''; }
    status(records.length ? 'Extraction complete. Review collection and file metadata before export.' : 'No PDFs found in this folder or its subfolders.');
  } catch (error) { reportError(error); }
  finally { setBusy(false); }
};
$('output').onclick = async () => {
  setBusy(true);
  try { output = await selectDirectory('readwrite'); $('output-name').textContent = output.name; status('Output directory selected. Export will create a new crate subfolder.'); }
  catch (error) { reportError(error); }
  finally { setBusy(false); }
};
$('form').onsubmit = async event => {
  event.preventDefault();
  if (busy || !$('form').reportValidity()) return;
  const collection = Object.fromEntries(['name', 'description', 'datePublished', 'license'].map(field => [field, $('collection-' + field).value]));
  collection.licenseReviewed = $('license-reviewed').checked;
  try {
    if (!output) throw new Error('Select an output directory first.');
    const included = records.filter(record => record.include);
    const manifest = createCrate(collection, included);
    if (included.some(record => !record.file)) throw new Error('An included PDF could not be read. Exclude it or select the source folder again.');
    setBusy(true); status('Exporting PDFs and reviewed metadata…');
    const name = await exportCrate(output, included, manifest);
    status(`Export complete: ${output.name}/${name}\n${included.length} unchanged PDFs and ro-crate-metadata.json written.`);
  } catch (error) { reportError(error); }
  finally { setBusy(false); }
};
if (!supported) status('Use desktop Chrome or Edge on localhost or HTTPS. This browser does not provide directory access here.');
setBusy(false);
