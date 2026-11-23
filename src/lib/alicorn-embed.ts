// Runs one AliKit component demo from public/stage/kit/kit.wasm on a canvas.
//
// kit.wasm carries a demo for every catalog page and runs the one named by
// `canvas.demo` when it starts. Alicorn's browser host (alicorn_webgpu_host.js)
// is a set of classic scripts that look elements up by id, so this supplies
// those ids, loads the scripts, and starts the app. One demo can run per page:
// the wasm keeps its application state in globals. Rebuild with
// stage/build-kit.sh.
import { withBase } from './paths';

interface AlicornHost {
  start(wasmUrl: string, options: { statusElement: { textContent: string } }): Promise<{
    exports: { default_context_ptr(): number; alicorn_browser_resize(context: number): void };
  }>;
}

export interface EmbedOptions {
  /** Catalog slug of the demo, for example `segmented`. */
  demo: string;
  canvas: HTMLCanvasElement;
  signal: AbortSignal;
  status(text: string): void;
  /** Report a failure: shows the message and marks the embed as failed. */
  error(text: string): void;
}

const here = () => new URL(withBase('/stage/kit/'), location.href);

const hostScripts = [
  'odin.js',
  'wgpu.js',
  'alicorn_demand_scheduler.js',
  'alicorn_accessibility_dom.js',
  'alicorn_webgpu_host.js',
];

function load(name: string) {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL(name, here()).href;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('could not load ' + name));
    document.head.append(script);
  });
}

/** True when the browser exposes WebGPU and hands out an adapter. */
export async function webgpuAvailable() {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  if (!gpu || !isSecureContext) return false;
  return Boolean(await gpu.requestAdapter().catch(() => null));
}

let started = false;

export async function startEmbed({ demo, canvas, signal, status, error }: EmbedOptions) {
  if (started) throw new Error('one demo can run per page');
  started = true;

  status('loading host');
  for (const name of hostScripts) {
    await load(name);
    if (signal.aborted) return;
  }

  // The ids and the demo name the app looks for.
  canvas.id = 'alicorn-canvas';
  canvas.tabIndex = 0;
  canvas.style.touchAction = 'none';
  (canvas as HTMLCanvasElement & { demo?: string }).demo = demo;
  const input = document.createElement('textarea');
  input.id = 'alicorn-text-input';
  input.tabIndex = -1;
  input.setAttribute('aria-label', 'Alicorn text input');
  input.autocomplete = 'off';
  input.autocapitalize = 'off';
  input.spellcheck = false;
  input.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;padding:0;border:0;resize:none;overflow:hidden;opacity:0;color:transparent;background:transparent;caret-color:transparent;font:1px/1px monospace;white-space:pre;pointer-events:none;z-index:1';
  const semantics = document.createElement('div');
  semantics.id = 'alicorn-accessibility';
  document.body.append(input, semantics);

  // The host reports through a status element; translate it for the embed.
  let text = '';
  const report = {
    get textContent() { return text; },
    set textContent(value) {
      text = String(value);
      if (/^WebGPU UI ready/.test(text)) status('running');
      else if (/^Starting/.test(text)) status('starting');
      else if (/^WebGPU device lost/.test(text)) status('recovering device');
      else error(text);
    },
  };

  status('fetching kit.wasm');
  const host = (globalThis as unknown as { AlicornWebGPUHost: AlicornHost }).AlicornWebGPUHost;
  // ui.run renames the document after the example; the page keeps its title.
  const title = document.title;
  const { exports } = await host.start(new URL('kit.wasm', here()).href, { statusElement: report });
  document.title = title;

  // The host resizes on window events; the embed can also change size alone.
  // Resizing a canvas clears it, and an observer reports once on attach, so
  // act only when the size really changed.
  const context = exports.default_context_ptr();
  let width = canvas.clientWidth, height = canvas.clientHeight;
  const observer = new ResizeObserver(() => {
    if (canvas.clientWidth === width && canvas.clientHeight === height) return;
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    exports.alicorn_browser_resize(context);
    (globalThis as unknown as { __alicornDemandScheduler?: { wake(): void } }).__alicornDemandScheduler?.wake();
  });
  observer.observe(canvas);
  signal.addEventListener('abort', () => observer.disconnect());
}
