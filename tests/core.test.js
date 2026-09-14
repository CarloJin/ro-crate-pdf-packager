import test from 'node:test';
import assert from 'node:assert/strict';
import { createCrate, fileId } from '../crate.js';
import { exportCrate, listPDFs } from '../files.js';

const collection = { name: 'Reviewed', description: 'Collection', datePublished: '2026-09-15', license: 'Permission required', licenseReviewed: true };
const record = path => ({ path, file: new File([new Uint8Array([0, 255, 42])], 'same.pdf'), metadata: { title: 'Edited title', authors: 'Alice\nBob', description: '', datePublished: '' } });
class Directory {
  kind = 'directory';
  children = new Map();
  async *entries() { yield* this.children; }
  async getDirectoryHandle(name, options) {
    if (!this.children.has(name)) { if (!options?.create) throw new Error('Not found'); this.children.set(name, new Directory()); }
    return this.children.get(name);
  }
  async getFileHandle(name) {
    if (!this.children.has(name)) {
      const entry = { kind: 'file', data: null, async getFile() { return this.data; }, async createWritable() { return { write: async data => { entry.data = data; }, close: async () => {}, abort: async () => {} }; } };
      this.children.set(name, entry);
    }
    return this.children.get(name);
  }
}
test('1.3 graph links, edited fields, omitted blanks and encoded nested paths', () => {
  const records = [record('a/same.pdf'), record('b/# café %.pdf')];
  const json = createCrate(collection, records);
  assert.deepEqual(json['@context'], ['https://w3id.org/ro/crate/1.3/context']);
  const graph = json['@graph'], root = graph.find(e => e['@id'] === './');
  assert.equal(root.license, collection.license);
  assert.equal(root.hasPart.length, 2);
  for (const r of records) {
    const entity = graph.find(e => e['@id'] === fileId(r.path));
    assert.equal(decodeURIComponent(entity['@id']), 'files/' + r.path);
    assert.equal(entity.name, 'Edited title');
    assert.ok(!('datePublished' in entity));
    assert.ok(!('description' in entity));
    for (const author of entity.author) assert.equal(graph.find(e => e['@id'] === author['@id'])['@type'], 'Person');
  }
  const descriptor = graph.find(e => e['@id'] === 'ro-crate-metadata.json');
  assert.equal(descriptor.about['@id'], './');
  assert.equal(descriptor.conformsTo['@id'], 'https://w3id.org/ro/crate/1.3');
});
test('required collection, licence review, failures and empty input are guarded', () => {
  for (const key of ['name', 'description', 'datePublished', 'license']) assert.throws(() => createCrate({ ...collection, [key]: ' ' }, [record('a.pdf')]));
  assert.throws(() => createCrate({ ...collection, licenseReviewed: false }, [record('a.pdf')]));
  assert.throws(() => createCrate(collection, []));
  const failed = { ...record('broken.pdf'), failed: true };
  assert.throws(() => createCrate(collection, [failed]));
  assert.doesNotThrow(() => createCrate(collection, [{ ...failed, failureConfirmed: true }]));
});
test('recursive PDF discovery and exports preserve original bytes and nested same names', async () => {
  const source = new Directory(), output = new Directory();
  const records = [record('a/same.pdf'), record('b/same.pdf')];
  for (const r of records) { const dir = await source.getDirectoryHandle(r.path[0], { create: true }); (await dir.getFileHandle('same.pdf')).data = r.file; }
  (await source.getFileHandle('ignore.txt')).data = new File(['ignored'], 'ignore.txt');
  const listed = await listPDFs(source);
  assert.deepEqual(listed.map(r => r.path), records.map(r => r.path));
  assert.equal(listed[0].file, records[0].file);
  const manifest = createCrate(collection, records);
  const name = await exportCrate(output, records, manifest);
  const directory = output.children.get(name), files = directory.children.get('files');
  for (const r of records) {
    const copied = files.children.get(r.path[0]).children.get('same.pdf').data;
    assert.deepEqual(new Uint8Array(await copied.arrayBuffer()), new Uint8Array(await r.file.arrayBuffer()));
  }
  assert.deepEqual(JSON.parse(directory.children.get('ro-crate-metadata.json').data), manifest);
  assert.notEqual(await exportCrate(output, records, manifest), name);
  assert.deepEqual(await listPDFs(new Directory()), []);
});
test('write failures cannot return export success', async () => {
  const output = new Directory();
  output.getDirectoryHandle = async () => { throw new DOMException('Denied', 'NotAllowedError'); };
  await assert.rejects(exportCrate(output, [record('a.pdf')], {}), /Export failed/);
});
test('partial copy failure reports incomplete output and does not write a manifest', async () => {
  const output = new Directory(), directory = new Directory(), files = new Directory();
  output.getDirectoryHandle = async () => directory;
  directory.children.set('files', files);
  files.getFileHandle = async () => ({ createWritable: async () => ({ write: async () => { throw new Error('Disk full'); }, abort: async () => {} }) });
  await assert.rejects(exportCrate(output, [record('a.pdf')], {}), /incomplete folder may remain/);
  assert.equal(directory.children.has('ro-crate-metadata.json'), false);
});
