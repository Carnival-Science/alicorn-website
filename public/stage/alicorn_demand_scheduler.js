(function (root, factory) {
	const Scheduler = factory();
	if (typeof module === "object" && module.exports) module.exports = Scheduler;
	else root.AlicornDemandScheduler = Scheduler;
})(globalThis, function () {
	"use strict";

	function asNs(value) {
		if (typeof value === "bigint") return value;
		const number = Number(value);
		return Number.isFinite(number) ? BigInt(Math.trunc(number)) : 0n;
	}

	// Owns browser wake scheduling only. Runtime stepping, paint decisions, and
	// WebGPU submission remain in Odin; the host calls wake() for input and
	// asynchronous completions, then follows each step's work/deadline result.
	class AlicornDemandScheduler {
		constructor(options) {
			if (!options || typeof options.runFrame !== "function") {
				throw new TypeError("runFrame callback is required");
			}
			this._raf = options.requestAnimationFrame || globalThis.requestAnimationFrame.bind(globalThis);
			this._cancelRaf = options.cancelAnimationFrame || globalThis.cancelAnimationFrame.bind(globalThis);
			this._setTimeout = options.setTimeout || globalThis.setTimeout.bind(globalThis);
			this._clearTimeout = options.clearTimeout || globalThis.clearTimeout.bind(globalThis);
			this._nowNs = options.nowNs || (() => asNs(globalThis.performance.now() * 1e6));
			this._runFrame = options.runFrame;
			this._onIdle = options.onIdle || null;
			this._onError = options.onError || (error => console.error(error));
			this._frame = null;
			this._timer = null;
			this._deadlineNs = 0n;
			this._visible = options.visible !== false;
			this._running = false;
			this._wakeDuringFrame = false;
			this._disposed = false;
			this.stats = { framesRequested: 0, framesRun: 0, timersArmed: 0 };
		}

		wake() {
			if (this._disposed || !this._visible) return false;
			if (this._running) {
				this._wakeDuringFrame = true;
				return true;
			}
			if (this._frame !== null) return false;
			this._clearDeadlineTimer();
			this._deadlineNs = 0n;
			this.stats.framesRequested++;
			const handle = this._raf(timestampMs => {
				if (this._frame !== handle) return;
				this._frame = null;
				this._step(asNs(Number(timestampMs) * 1e6));
			});
			this._frame = handle;
			return true;
		}

		setVisible(visible) {
			if (this._disposed || this._visible === !!visible) return;
			this._visible = !!visible;
			if (!this._visible) {
				if (this._frame !== null) this._cancelRaf(this._frame);
				this._frame = null;
				this._clearDeadlineTimer();
				return;
			}
			// Resume from current host time instead of replaying missed deadlines.
			this.wake();
		}

		dispose() {
			if (this._disposed) return;
			this._disposed = true;
			if (this._frame !== null) this._cancelRaf(this._frame);
			this._frame = null;
			this._clearDeadlineTimer();
			this._deadlineNs = 0n;
		}

		_step(nowNs) {
			if (this._disposed || !this._visible) return;
			this.stats.framesRun++;
			this._running = true;
			this._wakeDuringFrame = false;
			let result;
			try {
				result = this._runFrame(nowNs);
			} catch (error) {
				this._running = false;
				this._onError(error);
				return;
			}
			this._running = false;
			if (this._wakeDuringFrame) {
				this.wake();
				return;
			}
			if (this._disposed || !this._visible) return;
			if (result && result.hasMoreWork) {
				this.wake();
				return;
			}
			const deadline = result ? asNs(result.nextWakeNs) : 0n;
			if (deadline > asNs(this._nowNs())) {
				this._armDeadline(deadline);
				return;
			}
			this._deadlineNs = 0n;
			if (this._onIdle && (!result || result.notifyIdle !== false)) this._onIdle(this.stats);
		}

		_armDeadline(deadlineNs) {
			if (this._timer !== null && this._deadlineNs === deadlineNs) return;
			this._clearDeadlineTimer();
			this._deadlineNs = deadlineNs;
			const remaining = deadlineNs - asNs(this._nowNs());
			const delayMs = Math.max(0, Math.min(2_147_483_647, Number(remaining) / 1e6));
			this.stats.timersArmed++;
			const handle = this._setTimeout(() => {
				if (this._timer !== handle) return;
				this._timer = null;
				if (this._disposed || !this._visible) return;
				if (asNs(this._nowNs()) < this._deadlineNs) {
					this._armDeadline(this._deadlineNs);
					return;
				}
				this._deadlineNs = 0n;
				this.wake();
			}, delayMs);
			this._timer = handle;
		}

		_clearDeadlineTimer() {
			if (this._timer !== null) this._clearTimeout(this._timer);
			this._timer = null;
		}
	}

	return AlicornDemandScheduler;
});
