(function (root) {
	"use strict";

	function initializationFailureMessage(code) {
		switch (Number(code)) {
		case 1: return "WebGPU could not create an instance.";
		case 2: return "WebGPU could not create a presentation surface for this canvas.";
		case 3: return "No compatible WebGPU adapter is available. Check browser GPU support, drivers, and permissions.";
		case 4: return "The browser failed to request a WebGPU adapter. Check browser settings and the console.";
		case 5: return "The browser does not support presenting WebGPU to this canvas.";
		case 6: return "The browser could not create a WebGPU device. Check GPU settings and the console.";
		case 7: return "The WebGPU device did not provide a submission queue.";
		case 8: return "Alicorn could not initialize its WebGPU renderer for this canvas.";
		default: return "WebGPU initialization failed. Check browser compatibility and the console.";
		}
	}

	async function start(wasmUrl, options = {}) {
		if (!root.isSecureContext) {
			throw new Error("WebGPU requires a secure context. Serve this app over HTTPS or localhost.");
		}
		if (!root.navigator || !root.navigator.gpu) {
			throw new Error("This browser does not expose WebGPU. Use a WebGPU-capable browser.");
		}
		if (!root.odin || !root.AlicornDemandScheduler) {
			throw new Error("Load Odin's wasm JavaScript and AlicornDemandScheduler before starting the app.");
		}
		const memoryInterface = new root.odin.WasmMemoryInterface();
		memoryInterface.setIntSize(4);
		const wgpuInterface = new root.odin.WebGPUInterface(memoryInterface);
		const wgpuImports = wgpuInterface.getInterface();
		const imports = {
			...root.odin.setupDefaultImports(memoryInterface, null, memoryInterface.memory),
			wgpu: wgpuImports,
		};
		const response = await root.fetch(wasmUrl, { cache: "no-store" });
		if (!response.ok) throw new Error("WASM request failed: " + response.status);
		const { instance } = await root.WebAssembly.instantiate(await response.arrayBuffer(), imports);
		const exports = instance.exports;
		memoryInterface.setExports(exports);
		if (exports.memory) memoryInterface.setMemory(exports.memory);
		const context = exports.default_context_ptr();
		const clipboardResult = {
			success: 0,
			unsupported: 1,
			permissionDenied: 2,
			unavailable: 3,
			tooLarge: 4,
			cancelled: 5,
			failed: 6,
		};
		const clipboardLimit = 1024 * 1024;
		const clipboardFailureResult = error => {
			const name = String(error && error.name || "");
			if (name === "NotAllowedError" || name === "SecurityError") return clipboardResult.permissionDenied;
			if (name === "NotSupportedError" || name === "NotFoundError") return clipboardResult.unavailable;
			return clipboardResult.failed;
		};
		const clipboardComplete = (token, result, byteLength = 0) => {
			try {
				exports.alicorn_browser_clipboard_complete(context, token, result, byteLength);
			} catch (error) {
				root.console.error("[alicorn-webgpu] clipboard completion failed", error);
			}
		};
		root.__alicornWebGPUClipboard = {
			readText(token) {
				const api = root.navigator && root.navigator.clipboard;
				if (!api || typeof api.readText !== "function") {
					clipboardComplete(token, clipboardResult.unsupported);
					return;
				}
				let pending;
				try {
					// Invoke before returning to preserve the caller's transient user activation.
					pending = api.readText();
				} catch (error) {
					clipboardComplete(token, clipboardFailureResult(error));
					return;
				}
				Promise.resolve(pending).then(value => {
					try {
						const text = String(value);
						const scratch = new Uint8Array(clipboardLimit + 4);
						const encoded = new root.TextEncoder().encodeInto(text, scratch);
						if (encoded.read !== text.length || encoded.written > clipboardLimit) {
							clipboardComplete(token, clipboardResult.tooLarge);
							return;
						}
						if (encoded.written === 0) {
							clipboardComplete(token, clipboardResult.success);
							return;
						}
						const pointer = exports.alicorn_browser_clipboard_read_buffer(context, token, encoded.written);
						if (!pointer) {
							clipboardComplete(token, clipboardResult.unavailable);
							return;
						}
						memoryInterface.loadBytes(Number(pointer) >>> 0, encoded.written).set(scratch.subarray(0, encoded.written));
						clipboardComplete(token, clipboardResult.success, encoded.written);
					} catch (error) {
						clipboardComplete(token, clipboardFailureResult(error));
					}
				}, error => clipboardComplete(token, clipboardFailureResult(error)));
			},
			writeText(token, pointer, byteLength) {
				const api = root.navigator && root.navigator.clipboard;
				if (!api || typeof api.writeText !== "function") {
					clipboardComplete(token, clipboardResult.unsupported);
					return;
				}
				if (byteLength > clipboardLimit) {
					clipboardComplete(token, clipboardResult.tooLarge);
					return;
				}
				let pending;
				try {
					const text = memoryInterface.loadString(Number(pointer) >>> 0, byteLength);
					// Start the permission-gated operation in the originating event stack.
					pending = api.writeText(text);
				} catch (error) {
					clipboardComplete(token, clipboardFailureResult(error));
					return;
				}
				Promise.resolve(pending).then(
					() => clipboardComplete(token, clipboardResult.success),
					error => clipboardComplete(token, clipboardFailureResult(error)),
				);
			},
		};
		const status = options.statusElement || null;
		const readyMessage = "WebGPU UI ready. Resize, click, or type to exercise the retained host.";
		const recoveringMessage = "WebGPU device lost. Rebuilding presentation while preserving retained UI state…";
		let disposed = false;
		const scheduler = new root.AlicornDemandScheduler({
			visible: !root.document.hidden,
			runFrame: nowNs => {
				const state = exports.alicorn_browser_status(context);
				if (state === -2) {
					disposed = true;
					scheduler.dispose();
					return { hasMoreWork: false, nextWakeNs: 0n, notifyIdle: false };
				}
				if (state === 3) {
					const hasMoreWork = !!exports.alicorn_browser_frame(nowNs, context);
					const nextState = exports.alicorn_browser_status(context);
					if (nextState === -2) {
						disposed = true;
						scheduler.dispose();
					}
					return { hasMoreWork, nextWakeNs: 0n, notifyIdle: false };
				}
				if (state < 0) {
					if (status) {
						status.textContent = state === -3
							? "WebGPU recovery failed. Reload the page to restart."
							: initializationFailureMessage(exports.alicorn_browser_failure_code
								? exports.alicorn_browser_failure_code()
								: 0);
					}
					return { hasMoreWork: false, nextWakeNs: 0n, notifyIdle: false };
				}
				if (state === 2) {
					if (status) status.textContent = "The WebGPU device was explicitly destroyed or its loss callback was cancelled; automatic recovery is disabled.";
					return { hasMoreWork: false, nextWakeNs: 0n, notifyIdle: false };
				}
				if (state === 4) {
					if (status && status.textContent !== recoveringMessage) status.textContent = recoveringMessage;
					const hasMoreWork = !!exports.alicorn_browser_frame(nowNs, context);
					return {
						hasMoreWork,
						nextWakeNs: exports.alicorn_browser_next_wake_ns(context),
						notifyIdle: false,
					};
				}
				if (state !== 1) return { hasMoreWork: false, nextWakeNs: 0n, notifyIdle: false };
				if (status && status.textContent !== readyMessage) status.textContent = readyMessage;
				const hasMoreWork = !!exports.alicorn_browser_frame(nowNs, context);
				return {
					hasMoreWork,
					nextWakeNs: exports.alicorn_browser_next_wake_ns(context),
				};
			},
			onError: error => {
				if (status) status.textContent = "Browser runtime error: " + String(error && error.message || error);
				root.console.error("[alicorn-webgpu] scheduled frame failed", error);
			},
		});
		root.__alicornDemandScheduler = scheduler;
		if (status) status.textContent = "Starting the retained runtime and requesting a WebGPU device…";
		const dispatchCallback = wgpuInterface.callCallback.bind(wgpuInterface);
		wgpuInterface.callCallback = (callback, args) => {
			try { dispatchCallback(callback, args); }
			finally { scheduler.wake(); }
		};
		const canvas = root.document.getElementById(options.canvasId || "alicorn-canvas");
		if (!canvas) throw new Error("The page must contain the configured Alicorn canvas.");
		root.addEventListener("resize", () => {
			exports.alicorn_browser_resize(context);
			scheduler.wake();
		});
		root.document.addEventListener("visibilitychange", () => scheduler.setVisible(!root.document.hidden));
		root.addEventListener("pagehide", event => {
			if (disposed) return;
			// A page entering the back/forward cache keeps its JS/WASM state alive.
			// Suspend demand-driven work, then resume the same WebGPU host on pageshow.
			if (event && event.persisted) {
				scheduler.setVisible(false);
				return;
			}
			if (exports.alicorn_browser_shutdown(context)) {
				disposed = true;
				scheduler.dispose();
			}
		});
		root.addEventListener("pageshow", () => {
			if (!disposed) scheduler.setVisible(!root.document.hidden);
		});
		root.addEventListener("error", event => {
			if (status) status.textContent = "Browser runtime error: " + String(event.message || event.error || "unknown error");
		}, { once: true });
		exports._start();
		scheduler.wake();
		return { instance, exports, scheduler };
	}

	root.AlicornWebGPUHost = { start };
})(globalThis);
