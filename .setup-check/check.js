import { getDocument, GlobalWorkerOptions, PDFWorker } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { ROCrate } from 'ro-crate';
import { extractMetadata } from '../pdf-metadata.js';

window.setupResult = null;
try {
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
  const baseResult = { pass: true, browser: navigator.userAgent, realWorker: true, pages: pdf.numPages, title: metadata.info.Title, crateEntities: json['@graph'].length, directoryPicker: typeof showDirectoryPicker === 'function', secureContext: isSecureContext };
  await task.destroy();
  worker.destroy();
  const extracted = await extractMetadata(await (await fetch('/fixture.pdf')).arrayBuffer());
  if (extracted.failed || extracted.metadata.title !== 'Setup fixture' || extracted.metadata.datePublished !== '') throw new Error('Application extraction mismatch');
  const broken = await extractMetadata(new TextEncoder().encode('not a PDF').buffer);
  if (!broken.failed || broken.metadata.title !== '') throw new Error('Broken PDF must remain editable');
  const names = await (await fetch('/supplied-list')).json();
  const supplied = [];
  for (const [index, name] of names.entries()) {
    const result = await extractMetadata(await (await fetch(`/supplied-pdf/${index}`)).arrayBuffer());
    supplied.push({ name, ...result });
  }
  if (supplied.some(result => result.failed)) throw new Error('Supplied PDF extraction failure');
  window.setupResult = { ...baseResult, applicationExtraction: true, brokenPDFWarning: true, supplied };
} catch (error) { window.setupResult = { pass: false, error: String(error), stack: error?.stack }; }
document.querySelector('#result').textContent = JSON.stringify(window.setupResult, null, 2);
