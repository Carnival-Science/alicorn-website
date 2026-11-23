#!/usr/bin/env node
// Captures the material lab at fixed timestamps: comparison stills and short
// motion previews. Needs `npm run dev` on :4321, Google Chrome and ffmpeg.
//
//   node scripts/lab-capture.mjs                 # stills + motion
//   node scripts/lab-capture.mjs --stills-only
//   node scripts/lab-capture.mjs --fresh        # redo scenes already captured
//
// Output goes to lab/captures/. Chrome runs headless with SwiftShader, so
// every capture is deterministic and independent of the local GPU.
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const chrome = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const base = process.env.LAB_URL ?? 'http://localhost:4321/lab/material/';
const out = 'lab/captures';
const stillsOnly = process.argv.includes('--stills-only');
const scenes = ['sky', 'video:sky', 'video:foliage', 'video:ocean', 'foliage', 'ocean'];
const stillTimes = [4, 11, 19];
const motion = { seconds: 6, fps: 12, start: 3 };

mkdirSync(out, { recursive: true });
const profile = join(tmpdir(), `lab-capture-${process.pid}`);
const port = 9333;
const proc = spawn(chrome, [
  '--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars',
  '--autoplay-policy=no-user-gesture-required', '--window-size=1400,900', `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });

async function target() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Chrome did not start');
}

const ws = new WebSocket(await target());
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
});
const send = (method, params = {}) => new Promise((resolve) => { const n = ++id; pending.set(n, resolve); ws.send(JSON.stringify({ id: n, method, params })); });
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? 'eval failed');
  return r.result?.result?.value;
}
async function png(path) {
  const data = await evaluate('window.__lab.png()');
  writeFileSync(path, Buffer.from(data.split(',')[1], 'base64'));
}

await send('Page.enable');
await send('Page.navigate', { url: `${base}?compare=1&t=0` });
for (let i = 0; i < 100 && !(await evaluate('!!window.__lab')); i++) await new Promise((r) => setTimeout(r, 200));

const slug = (s) => s.replace(':', '-');
const fresh = process.argv.includes('--fresh');
for (const scene of scenes) {
  const done = existsSync(join(out, `motion-${slug(scene)}.mp4`)) || (stillsOnly && existsSync(join(out, `bypass-${slug(scene)}.png`)));
  if (done && !fresh) { process.stdout.write(`skip ${scene}\n`); continue; }
  await evaluate(`window.__lab.set({ scene: ${JSON.stringify(scene)}, compare: true, paused: true })`);
  for (const t of stillTimes) {
    await evaluate(`window.__lab.at(${t})`);
    await png(join(out, `compare-${slug(scene)}-t${String(t).padStart(2, '0')}.png`));
    process.stdout.write(`still ${scene} t=${t}\n`);
  }
  // the bare scene, for reference
  await evaluate('window.__lab.set({ bypass: true, compare: false })');
  await evaluate(`window.__lab.at(${stillTimes[1]})`);
  await png(join(out, `bypass-${slug(scene)}.png`));
  await evaluate('window.__lab.set({ bypass: false, compare: true })');

  if (stillsOnly) continue;
  const frames = join(tmpdir(), `lab-frames-${process.pid}-${slug(scene)}`);
  mkdirSync(frames, { recursive: true });
  const n = motion.seconds * motion.fps;
  for (let i = 0; i < n; i++) {
    await evaluate(`window.__lab.at(${motion.start + i / motion.fps})`);
    await png(join(frames, `f${String(i).padStart(4, '0')}.png`));
  }
  execFileSync('ffmpeg', ['-nostdin', '-v', 'error', '-y', '-framerate', String(motion.fps), '-i', join(frames, 'f%04d.png'),
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-movflags', '+faststart',
    join(out, `motion-${slug(scene)}.mp4`)]);
  rmSync(frames, { recursive: true, force: true });
  process.stdout.write(`motion ${scene}\n`);
}

ws.close();
proc.kill();
await new Promise((r) => proc.once('exit', r));
rmSync(profile, { recursive: true, force: true, maxRetries: 5 });
