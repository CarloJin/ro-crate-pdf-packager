import { ROCrate } from 'ro-crate';

export function pathParts(path) {
  const parts = path.split('/');
  if (parts.some(p => !p || p === '.' || p === '..' || p.includes('\\'))) throw new Error('Invalid relative PDF path');
  return parts;
}
export const fileId = path => `files/${pathParts(path).map(encodeURIComponent).join('/')}`;
export function createCrate(collection, records) {
  for (const key of ['name', 'description', 'datePublished', 'license']) {
    if (!collection[key]?.trim()) throw new Error(`Collection ${key} is required.`);
  }
  if (!collection.licenseReviewed) throw new Error('Explicitly confirm the reviewed licence.');
  if (!records.length) throw new Error('Include at least one PDF.');
  const crate = new ROCrate({ '@context': 'https://w3id.org/ro/crate/1.3/context', '@graph': [] });
  const root = crate.rootDataset;
  for (const key of ['name', 'description', 'datePublished', 'license']) root[key] = collection[key].trim();
  crate.getEntity('ro-crate-metadata.json').conformsTo = { '@id': 'https://w3id.org/ro/crate/1.3' };
  const ids = new Set();
  root.hasPart = records.map((record, index) => {
    if (record.failed && !record.failureConfirmed) throw new Error(`Confirm inclusion of ${record.path}.`);
    const id = fileId(record.path);
    if (ids.has(id)) throw new Error('Duplicate PDF path');
    ids.add(id);
    const entity = { '@id': id, '@type': 'File', encodingFormat: 'application/pdf' };
    for (const [field, property] of [['title', 'name'], ['description', 'description'], ['datePublished', 'datePublished']]) {
      if (record.metadata[field]?.trim()) entity[property] = record.metadata[field].trim();
    }
    const authors = record.metadata.authors.split('\n').map(x => x.trim()).filter(Boolean);
    if (authors.length) entity.author = authors.map((name, authorIndex) => {
      const personId = `#person-${index + 1}-${authorIndex + 1}`;
      crate.addEntity({ '@id': personId, '@type': 'Person', name });
      return { '@id': personId };
    });
    crate.addEntity(entity);
    return { '@id': id };
  });
  return crate.toJSON();
}
