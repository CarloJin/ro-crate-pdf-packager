import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Generate a tiny valid PDF without adding a fixture-generation dependency.
const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
const stream = 'BT /F1 12 Tf 20 100 Td (Hello PDF) Tj ET';
objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`, '<< /Title (Setup fixture) /Author (Setup check) >>');
let pdf = '%PDF-1.4\n';
const offsets = [0];
objects.forEach((object, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; });
const xref = pdf.length;
pdf += `xref\n0 7\n0000000000 65535 f \n${offsets.slice(1).map(x => `${String(x).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
const suppliedDirectory = path.resolve('../supplied_files');
const supplied = (await readdir(suppliedDirectory)).filter(name => /\.pdf$/i.test(name));
const server = await createServer({ plugins: [{ name: 'setup-fixture', configureServer(server) {
  server.middlewares.use('/fixture.pdf', (_req, res) => { res.setHeader('Content-Type', 'application/pdf'); res.end(pdf); });
  server.middlewares.use('/supplied-list', (_req, res) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(supplied)); });
  server.middlewares.use('/supplied-pdf', async (req, res) => {
    const index = Number(req.url.slice(1));
    if (!Number.isInteger(index) || !supplied[index]) { res.statusCode = 404; res.end(); return; }
    try { res.setHeader('Content-Type', 'application/pdf'); res.end(await readFile(path.join(suppliedDirectory, supplied[index]))); }
    catch (error) { res.statusCode = 500; res.end(error.message); }
  });
} }], server: { host: '127.0.0.1', port: 5179, strictPort: true, watch: { ignored: ['**/.setup-check/profile/**'] } } });
await server.listen();
const browser = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9239', `--user-data-dir=${path.resolve('.setup-check/profile')}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let socket;
try {
  let pages;
  for (let i = 0; i < 100; i++) { try { pages = await (await fetch('http://127.0.0.1:9239/json')).json(); if (pages.length) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
  socket = new WebSocket(pages.find(x => x.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let id = 0;
  const pending = new Map();
  socket.onmessage = e => { const data = JSON.parse(e.data); if (data.id) { pending.get(data.id)?.(data); pending.delete(data.id); } };
  const send = (method, params = {}) => new Promise(resolve => { pending.set(++id, resolve); socket.send(JSON.stringify({ id, method, params })); });
  if (process.env.COMPAT_CHECK) await send('Page.addScriptToEvaluateOnNewDocument', {
    source: 'delete Map.prototype.getOrInsertComputed;',
  });
  await send('Page.navigate', { url: 'http://127.0.0.1:5179/.setup-check/index.html' + (process.env.COMPAT_CHECK ? '?compat' : '') });
  let result;
  for (let i = 0; i < 150; i++) {
    const reply = await send('Runtime.evaluate', { expression: 'window.setupResult', returnByValue: true });
    result = reply.result?.result?.value;
    if (result) break;
    await new Promise(r => setTimeout(r, 200));
  }
  if (!result) throw new Error('Browser smoke check timed out');
  await writeFile(process.env.CHECK_RESULT || '.setup-check/result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
  if (!result.pass || !result.directoryPicker || !result.secureContext) process.exitCode = 1;
  socket.send(JSON.stringify({ id: ++id, method: 'Browser.close' }));
} finally { socket?.close(); browser.kill(); await server.close(); }



