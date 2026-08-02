/*
 * Renders the audio engine to WAV files you can actually listen to.
 *
 *   node tools/render-samples.mjs
 *
 * Serves the project over HTTP, drives headless Chrome through an
 * OfflineAudioContext render of every layer and a few presets, and writes the
 * results to samples/. No speakers or audio hardware required, which is the
 * point: it is how you check the synthesis on a machine that cannot play sound.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'samples');
const PORT = 5411;

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
].find((p) => fs.existsSync(p));

if (!CHROME) {
  console.error('Chrome not found. Install Chrome or edit the CHROME list above.');
  process.exit(1);
}

fs.mkdirSync(OUT, { recursive: true });

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
};

let finish;
const done = new Promise((r) => {
  finish = r;
});

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/save') {
    const name = path.basename(req.headers['x-name'] || 'out.wav');
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      fs.writeFileSync(path.join(OUT, name), Buffer.concat(chunks));
      res.end('ok');
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/done') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      res.end('ok');
      finish(JSON.parse(Buffer.concat(chunks).toString() || '[]'));
    });
    return;
  }

  const rel = decodeURIComponent((req.url || '/').split('?')[0]);
  const file = path.join(ROOT, rel === '/' ? 'tools/render.html' : rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, async () => {
  console.log(`serving ${ROOT} on :${PORT}`);

  const chrome = spawn(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--autoplay-policy=no-user-gesture-required',
    `--user-data-dir=${path.join(OUT, '.chrome-profile')}`,
    `http://127.0.0.1:${PORT}/tools/render.html`,
  ]);
  chrome.stderr.on('data', (d) => {
    const s = String(d);
    if (/ERROR|FAIL/i.test(s)) process.stderr.write(s);
  });

  const timeout = setTimeout(() => {
    console.error('timed out after 5 minutes');
    chrome.kill();
    server.close();
    process.exit(1);
  }, 300_000);

  const results = await done;
  clearTimeout(timeout);
  chrome.kill();
  server.close();

  console.log('\n  sample                  peak      rms      silence');
  console.log('  ' + '-'.repeat(52));
  for (const r of results) {
    if (r.error) {
      console.log(`  ${r.name.padEnd(22)} FAILED: ${r.error}`);
    } else {
      console.log(
        `  ${r.name.padEnd(22)} ${String(r.peak).padEnd(9)} ${String(r.rmsDb).padEnd(8)} ${r.quietWindows} windows`,
      );
    }
  }
  console.log(`\nWAVs written to ${OUT}`);
  process.exit(0);
});
