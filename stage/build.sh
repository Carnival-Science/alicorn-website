#!/bin/sh
# Build the homepage stage app (stage/app) for the browser and publish it,
# with Alicorn's browser host files, into public/stage/.
#
#   ./stage/build.sh [path/to/Alicorn]
#
# Needs Odin and wasm-ld (LLVM's lld) on PATH. The Alicorn checkout defaults to
# ../alicorn. The output is committed because CI does not build Odin.
set -eu

SITE=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd -P)
ALICORN=$(CDPATH='' cd -- "${1:-$SITE/../alicorn}" && pwd -P)
OUT=$SITE/public/stage

command -v odin >/dev/null || { echo "odin is not on PATH" >&2; exit 1; }
if ! command -v wasm-ld >/dev/null; then
	# Homebrew keeps lld keg-only.
	for keg in /opt/homebrew/opt/lld/bin /opt/homebrew/opt/lld@22/bin /usr/local/opt/lld/bin; do
		[ -x "$keg/wasm-ld" ] && PATH="$keg:$PATH" && break
	done
fi
command -v wasm-ld >/dev/null || { echo "wasm-ld is not on PATH (install lld)" >&2; exit 1; }

ODIN_ROOT=$(odin root)
mkdir -p "$OUT"
odin build "$SITE/stage/app" "-collection:alicorn=$ALICORN" -target:js_wasm32 -o:size \
	"-out:$OUT/app.wasm" -extra-linker-flags:--export-table
cp "$ODIN_ROOT/core/sys/wasm/js/odin.js" "$OUT/odin.js"
cp "$ODIN_ROOT/vendor/wgpu/wgpu.js" "$OUT/wgpu.js"
node "$ALICORN/tools/patch_odin_wgpu_js.js" "$OUT/wgpu.js"
cp "$ALICORN/host/web/demand_scheduler.js" "$OUT/alicorn_demand_scheduler.js"
cp "$ALICORN/host/web/accessibility_dom.js" "$OUT/alicorn_accessibility_dom.js"
cp "$ALICORN/host/web/webgpu_ui_host.js" "$OUT/alicorn_webgpu_host.js"
printf 'Stage build complete: %s\n' "$OUT"
