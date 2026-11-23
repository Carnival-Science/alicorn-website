// Stage loader: mounts the Alicorn app in public/stage/app.wasm onto the
// homepage canvas.
//
// Alicorn's browser host (alicorn_webgpu_host.js) is a set of classic scripts
// that look up their elements by id, so this module supplies those ids, loads
// the scripts, and hands the app to the host. Rebuild with stage/build.sh.
import { withBase } from './paths';
import type { StageMount } from './stage';

interface AlicornHost {
  start(wasmUrl: string, options: { statusElement: { textContent: string } }): Promise<{
    exports: { default_context_ptr(): number; alicorn_browser_resize(context: number): void };
  }>;
}

const here = new URL(withBase('/stage/'), location.href);

function load(name: string) {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL(name, here).href;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('could not load ' + name));
    document.head.append(script);
  });
}

const mount: StageMount = async ({ canvas, signal, status, error }) => {
  // Odin's runtime scripts, in dependency order.
  for (const name of ['odin.js', 'wgpu.js', 'alicorn_demand_scheduler.js', 'alicorn_accessibility_dom.js', 'alicorn_webgpu_host.js']) {
    await load(name);
    if (signal.aborted) return;
  }

  // The ids the host expects.
  canvas.id = 'alicorn-canvas';
  canvas.tabIndex = 0;
  canvas.style.touchAction = 'none';
  canvas.setAttribute('aria-label', 'Alicorn app');
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

  // The host reports through a status element; translate it for the stage.
  let text = '';
  const report = {
    get textContent() { return text; },
    set textContent(value) {
      text = String(value);
      if (/^WebGPU UI ready/.test(text)) status('running');
      else if (/^(Starting|WebGPU device lost)/.test(text)) status(text.startsWith('WebGPU') ? 'recovering device' : 'starting');
      else error(text);
    },
  };

  status('fetching app.wasm');
  const host = (globalThis as unknown as { AlicornWebGPUHost: AlicornHost }).AlicornWebGPUHost;
  const { exports } = await host.start(new URL('app.wasm', here).href, { statusElement: report });

  // The host resizes on window events; the stage can also change size alone.
  const context = exports.default_context_ptr();
  // Resizing a canvas clears it, and an observer reports once on attach, so
  // act only when the size really changed.
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
};

export default mount;
