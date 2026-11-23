/**
 * The stage is the homepage slot for an Alicorn app compiled for the web
 * (WebGPU host), and the contract a build has to meet to run in it.
 *
 * The app is `stage/app/main.odin`. `stage/build.sh` compiles it for
 * `js_wasm32` and publishes it, with Alicorn's browser host files, under
 * `public/stage/`. `stage-loader.ts` mounts it; its default export follows
 * `StageMount`. The drawer shows the app source and the loader as they are.
 *
 * To swap in a different app: change `stage/app`, run `stage/build.sh`, and
 * commit `public/stage/`. Set `live: false` to put the stage back on standby.
 */
import appSource from '../../stage/app/main.odin?raw';
import loaderSource from './stage-loader.ts?raw';

export interface StageHost {
  canvas: HTMLCanvasElement;
  /** Aborted when the page leaves or the stage is torn down. */
  signal: AbortSignal;
  /** Report progress to the stage's status line. */
  status(text: string): void;
  /** Report a failure: shows the message and turns the stage lamp red. */
  error(text: string): void;
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
  /** True when an app is mounted; false keeps the stage on standby. */
  live: boolean;
  /** True while `source` is placeholder material, not the mounted app. */
  placeholderSource: boolean;
  source: SourceFile[];
}

export const stage: StageConfig = {
  id: 'STAGE 01',
  title: 'stage.app',
  width: 960,
  height: 600,
  live: true,
  placeholderSource: false,
  source: [
    { path: 'main.odin', lang: 'odin', code: appSource.trim() },
    { path: 'stage-loader.ts', lang: 'ts', code: loaderSource.trim() },
  ],
};
