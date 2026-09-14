import { pathParts } from './crate.js';

export const selectDirectory = mode => window.showDirectoryPicker({ mode });
export async function listPDFs(directory, prefix = '') {
  const records = [];
  for await (const [name, handle] of directory.entries()) {
    const path = prefix + name;
    if (handle.kind === 'directory') records.push(...await listPDFs(handle, `${path}/`));
    else if (/\.pdf$/i.test(name)) {
      try { records.push({ path, file: await handle.getFile() }); }
      catch (error) { records.push({ path, file: null, readError: error.message }); }
    }
  }
  return records.sort((a, b) => a.path.localeCompare(b.path));
}
async function write(directory, name, data) {
  const handle = await directory.getFileHandle(name, { create: true });
  const stream = await handle.createWritable();
  try { await stream.write(data); await stream.close(); }
  catch (error) { try { await stream.abort(); } catch {} throw error; }
}
export async function exportCrate(output, records, manifest) {
  const name = `ro-crate-${crypto.randomUUID()}`;
  // Refuse any pre-existing entry before creating this unique export folder.
  for await (const [existing] of output.entries()) if (existing === name) throw new Error('Output folder already exists. Try export again.');
  let created = false;
  try {
    const directory = await output.getDirectoryHandle(name, { create: true });
    created = true;
    const files = await directory.getDirectoryHandle('files', { create: true });
    for (const record of records) {
      if (!record.file) throw new Error(`Cannot read ${record.path}. Select the source folder again.`);
      const parts = pathParts(record.path);
      let parent = files;
      for (const part of parts.slice(0, -1)) parent = await parent.getDirectoryHandle(part, { create: true });
      await write(parent, parts.at(-1), record.file);
    }
    await write(directory, 'ro-crate-metadata.json', JSON.stringify(manifest, null, 2));
    return name;
  } catch (error) {
    throw new Error(`Export failed: ${error.message}${created ? ` An incomplete folder may remain: ${name}. It is not a completed crate.` : ''}`);
  }
}
