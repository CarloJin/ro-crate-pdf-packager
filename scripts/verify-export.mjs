import assert from 'node:assert/strict';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const [sourceArgument, outputArgument] = process.argv.slice(2);
assert.ok(sourceArgument && outputArgument, 'Usage: node scripts/verify-export.mjs <source> <output>');
const source = path.resolve(sourceArgument), output = path.resolve(outputArgument);
const array = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
const hasType = (entity, type) => array(entity?.['@type']).includes(type);
async function pdfPaths(directory, prefix = '') {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix + entry.name;
    if (entry.isDirectory()) result.push(...await pdfPaths(path.join(directory, entry.name), relative + '/'));
    else if (entry.isFile() && /\.pdf$/i.test(entry.name)) result.push(relative);
  }
  return result.sort();
}
const sha256 = async filename => createHash('sha256').update(await readFile(filename)).digest('hex');
const sourcePaths = await pdfPaths(source);
assert.ok(sourcePaths.length, 'Source contains no PDFs');
const crates = (await readdir(output, { withFileTypes: true })).filter(entry => entry.isDirectory());
assert.ok(crates.length, 'No exported crate folders');
const report = { source, output, scope: 'Focused actual-export check, not full conformance validation', crates: [] };
for (const entry of crates) {
  const directory = path.join(output, entry.name);
  const json = JSON.parse(await readFile(path.join(directory, 'ro-crate-metadata.json'), 'utf8'));
  assert.ok(array(json['@context']).includes('https://w3id.org/ro/crate/1.3/context'), 'Missing 1.3 context');
  assert.ok(Array.isArray(json['@graph']), 'Missing graph');
  const entities = new Map(json['@graph'].map(entity => [entity['@id'], entity]));
  assert.equal(entities.size, json['@graph'].length, 'Duplicate entity IDs');
  const root = entities.get('./'), descriptor = entities.get('ro-crate-metadata.json');
  assert.ok(hasType(root, 'Dataset'), 'Root Dataset missing');
  assert.ok(hasType(descriptor, 'CreativeWork'), 'Descriptor type incorrect');
  assert.deepEqual(descriptor.about, { '@id': './' });
  assert.deepEqual(descriptor.conformsTo, { '@id': 'https://w3id.org/ro/crate/1.3' });
  for (const key of ['name', 'description', 'datePublished', 'license']) assert.ok(typeof root[key] === 'string' && root[key].trim(), `Missing collection ${key}`);
  const files = json['@graph'].filter(entity => hasType(entity, 'File'));
  let hasPartReferences = 0, authorReferences = 0;
  for (const entity of json['@graph']) {
    for (const property of ['hasPart', 'author']) for (const ref of array(entity[property])) {
      assert.ok(ref && typeof ref['@id'] === 'string' && entities.has(ref['@id']), `Unresolved ${property} reference`);
      if (property === 'author') { authorReferences++; assert.ok(hasType(entities.get(ref['@id']), 'Person')); }
      else hasPartReferences++;
    }
    if (hasType(entity, 'File') || hasType(entity, 'Person')) {
      for (const property of ['name', 'description', 'datePublished', 'author']) if (property in entity) {
        const values = array(entity[property]);
        assert.ok(values.length && values.every(value => value != null && (typeof value !== 'string' || value.trim())), `Blank optional ${property} on ${entity['@id']}`);
      }
    }
  }
  assert.deepEqual(array(root.hasPart).map(ref => ref['@id']).sort(), files.map(file => file['@id']).sort(), 'Root parts and File entities differ');
  const outputPaths = await pdfPaths(path.join(directory, 'files'));
  assert.deepEqual(outputPaths, sourcePaths, 'Source/output PDF paths or counts differ');
  const base = pathToFileURL(directory + path.sep);
  const resolvedPaths = [];
  for (const file of files) {
    const url = new URL(file['@id'], base);
    assert.equal(url.protocol, 'file:');
    assert.equal(url.search + url.hash, '', 'File ID contains unescaped query or fragment');
    const relative = path.relative(path.join(directory, 'files'), fileURLToPath(url)).split(path.sep).join('/');
    assert.ok(!relative.startsWith('../') && !path.isAbsolute(relative), 'File ID escapes files directory');
    assert.ok(outputPaths.includes(relative), `File ID has no copied PDF: ${file['@id']}`);
    resolvedPaths.push(relative);
  }
  assert.deepEqual(resolvedPaths.sort(), outputPaths, 'File entities do not match copied PDFs');
  const hashes = [];
  for (const relative of sourcePaths) {
    const sourceHash = await sha256(path.join(source, relative));
    const outputHash = await sha256(path.join(directory, 'files', relative));
    assert.equal(outputHash, sourceHash, `PDF bytes differ: ${relative}`);
    hashes.push({ path: relative, sourceSHA256: sourceHash, outputSHA256: outputHash });
  }
  report.crates.push({ folder: entry.name, pass: true, files: files.length, hasPartReferences, authorReferences,
    collection: Object.fromEntries(['name', 'description', 'datePublished', 'license'].map(key => [key, root[key]])),
    fileMetadata: files.map(file => ({ id: file['@id'], name: file.name, description: file.description, datePublished: file.datePublished, author: file.author })), hashes });
}
await writeFile('.setup-check/export-verification.json', JSON.stringify(report, null, 2) + '\n');
for (const crate of report.crates) console.log(`PASS ${crate.folder}: 1.3 structure; ${crate.hasPartReferences} hasPart and ${crate.authorReferences} author references; nonblank metadata; ${crate.files} matching PDF paths and SHA-256 hashes. Collection: ${JSON.stringify(crate.collection)}`);
console.log('Limit: original browser review state is unavailable; exported values are inspected, not compared with an independent review snapshot. Zero author references do not exercise author linkage.');
