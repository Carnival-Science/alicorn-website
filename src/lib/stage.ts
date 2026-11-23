/**
 * The stage is the reserved slot for an Alicorn app compiled for the web
 * (WebGPU host). Nothing here runs an app yet; it defines the contract a
 * build has to meet so it can be dropped in without touching the page.
 *
 * To mount an app:
 *  1. Publish its loader under `public/stage/` (or any URL).
 *  2. Set `stage.module` to that URL.
 *  3. Replace `stage.source` with the files a visitor can peek at.
 *
 * The loader is an ES module whose default export follows `StageMount`.
 */
export interface StageHost {
  canvas: HTMLCanvasElement;
  /** Aborted when the page leaves or the stage is torn down. */
  signal: AbortSignal;
  /** Report progress to the stage's status line. */
  status(text: string): void;
}

export type StageMount = (host: StageHost) => Promise<void | (() => void)>;

export interface SourceFile {
  path: string;
  lang: string;
  code: string;
  /** Optional link to the pinned file upstream. */
  href?: string;
}

export interface StageConfig {
  id: string;
  title: string;
  /** Native resolution the app was designed for. */
  width: number;
  height: number;
  /** URL of the module that exports a `StageMount`, or null for standby. */
  module: string | null;
  /** True while `source` is placeholder material, not the mounted app. */
  placeholderSource: boolean;
  source: SourceFile[];
}

export const stage: StageConfig = {
  id: 'STAGE 01',
  title: 'untitled.app',
  width: 960,
  height: 600,
  module: null,
  placeholderSource: true,
  // Placeholder: the documented starter from "Your first native app".
  source: [
    {
      path: 'main.odin',
      lang: 'odin',
      href: 'https://github.com/Carnival-Science/Alicorn/blob/master/examples/01_hello/main.odin',
      code: `import ui "alicorn:ui"

App :: struct { saved: bool }

render :: proc(app: ^App, ctx: ^ui.UI) {
    if ui.column(ctx, padding=24, gap=12) {
        ui.text(ctx, "Hello, Alicorn")
        if ui.button(ctx, "Save") {
            app.saved = true
        }
    }
}

main :: proc() {
    app := App{}
    ui.run(&app, render, title="Alicorn", width=720, height=480)
}`,
    },
    {
      path: 'stage.mjs',
      lang: 'js',
      code: `// The loader the page imports when stage.module is set.
export default async function mount({ canvas, signal, status }) {
  if (!navigator.gpu) throw new Error('WebGPU unavailable')
  status('fetching app.wasm')
  // instantiate the Odin build, hand it the canvas,
  // and stop the frame loop when signal aborts.
}`,
    },
  ],
};
