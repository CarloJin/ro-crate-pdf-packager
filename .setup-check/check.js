import { getDocument, GlobalWorkerOptions, PDFWorker, version } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { ROCrate } from 'ro-crate';
import { extractMetadata } from '../pdf-metadata.js';

window.setupResult = null;
try {
  if (location.search.includes('compat')) delete Map.prototype.getOrInsertComputed;
  GlobalWorkerOptions.workerSrc = workerUrl;
  const worker = new PDFWorker();
  await worker.promise;
  if (!(worker.port instanceof Worker)) throw new Error('PDF.js used a fake worker');
  const task = getDocument({ url: '/fixture.pdf', worker });
  const pdf = await task.promise;
  const metadata = await pdf.getMetadata();
  const content = await (await pdf.getPage(1)).getTextContent();
  if (metadata.info.Title !== 'Setup fixture' || !content.items.some(x => x.str.includes('Hello PDF'))) throw new Error('PDF content/metadata mismatch');
  const crate = new ROCrate({ '@context': 'https://w3id.org/ro/crate/1.3/context', '@graph': [] });
  crate.rootDataset.name = 'Setup crate';
  crate.getEntity('ro-crate-metadata.json').conformsTo = { '@id': 'https://w3id.org/ro/crate/1.3' };
  crate.addEntity({ '@id': 'files/fixture.pdf', '@type': 'File', name: metadata.info.Title });
  crate.rootDataset.hasPart = [{ '@id': 'files/fixture.pdf' }];
  const json = JSON.parse(JSON.stringify(crate));
  const root = json['@graph'].find(x => x['@id'] === './');
  const descriptor = json['@graph'].find(x => x['@id'] === 'ro-crate-metadata.json');
  if (!json['@context'].includes('https://w3id.org/ro/crate/1.3/context') || root.hasPart[0]['@id'] !== 'files/fixture.pdf' || descriptor.conformsTo['@id'] !== 'https://w3id.org/ro/crate/1.3') throw new Error('Crate serialisation mismatch');
  const baseResult = { pass: true, pdfjsVersion: version, mapGetOrInsertComputed: typeof Map.prototype.getOrInsertComputed, browser: navigator.userAgent, realWorker: true, pages: pdf.numPages, title: metadata.info.Title, crateEntities: json['@graph'].length, directoryPicker: typeof showDirectoryPicker === 'function', secureContext: isSecureContext };
  await task.destroy();
  worker.destroy();
  const extracted = await extractMetadata(await (await fetch('/fixture.pdf')).arrayBuffer());
  if (extracted.failed || extracted.metadata.title !== 'Setup fixture' || extracted.metadata.authors !== 'Setup check' || extracted.metadata.datePublished !== '') throw new Error('Application extraction mismatch');
  const broken = await extractMetadata(new TextEncoder().encode('not a PDF').buffer);
  if (!broken.failed || broken.metadata.title !== '') throw new Error('Broken PDF must remain editable');
  const names = await (await fetch('/supplied-list')).json();
  const supplied = [];
  const originalFiles = [];
  for (const [index, name] of names.entries()) {
    const bytes = await (await fetch(`/supplied-pdf/${index}`)).arrayBuffer();
    originalFiles.push(new File([bytes], name));
    const result = await extractMetadata(bytes);
    supplied.push({ name, ...result });
  }
  if (supplied.some(result => result.failed)) throw new Error('Supplied PDF extraction failure');
  // Exercise the actual UI, substituting only the native directory picker.
  const frame = document.createElement('iframe');
  frame.src = '/';
  await new Promise(resolve => { frame.onload = resolve; document.body.append(frame); });
  const app = frame.contentWindow, doc = app.document;
  if (location.search.includes('compat')) delete app.Map.prototype.getOrInsertComputed;
  app.showDirectoryPicker = async () => ({
    name: 'supplied_files',
    async *entries() { for (const file of originalFiles) yield [file.name, { kind: 'file', getFile: async () => file }]; },
  });
  doc.getElementById('source').click();
  for (let i = 0; i < 100 && doc.getElementById('source').disabled; i++) await new Promise(resolve => setTimeout(resolve, 100));
  const buttons = [...doc.querySelectorAll('#file-list button')];
  if (buttons.length !== names.length || buttons.some(button => !button.textContent.includes('Extracted'))) throw new Error('Supplied PDF UI listing/extraction failed');
  const authors = doc.getElementById('file-authors');
  if (authors.value !== '' || authors.matches(':disabled') || doc.getElementById('file-warning').textContent) throw new Error('Missing metadata is not blank and editable');
  authors.value = 'Manually reviewed author';
  authors.dispatchEvent(new app.Event('input', { bubbles: true }));
  buttons[1].click();
  doc.querySelector('#file-list button').click();
  if (authors.value !== 'Manually reviewed author') throw new Error('Manual metadata edit was lost');
  frame.remove();
  window.setupResult = { ...baseResult, applicationExtraction: true, brokenPDFWarning: true, suppliedRows: buttons.length, missingMetadataEditable: true, editsPersisted: true, supplied };
} catch (error) { window.setupResult = { pass: false, error: String(error), stack: error?.stack }; }
document.querySelector('#result').textContent = JSON.stringify(window.setupResult, null, 2);
