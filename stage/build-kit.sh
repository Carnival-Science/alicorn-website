#!/bin/sh
# Build the component demos (stage/kit) for the browser and publish them, with
# Alicorn's browser host files, into public/stage/kit/.
#
#   ./stage/build-kit.sh [path/to/Alicorn [path/to/alicorn-kit]]
#
# One wasm carries a demo for every catalog page; the page picks one by name.
# The demos are the AliKit examples, so they build against the AliKit revision
# in alikit-catalog.json and the Alicorn revision that AliKit pins in its
# dependencies.lock.json. Both are read with `git archive`, so the checkouts
# you pass need those commits but can be on any branch. With no AliKit path it
# is cloned from GitHub. Needs Odin, node and wasm-ld (LLVM's lld) on PATH.
# The output is committed because CI does not build Odin.
set -eu

SITE=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd -P)
ALICORN=$(CDPATH='' cd -- "${1:-$SITE/../alicorn}" && pwd -P)
ALIKIT=${2:+$(CDPATH='' cd -- "$2" && pwd -P)}
OUT=$SITE/public/stage/kit

command -v odin >/dev/null || { echo "odin is not on PATH" >&2; exit 1; }
command -v node >/dev/null || { echo "node is not on PATH" >&2; exit 1; }
if ! command -v wasm-ld >/dev/null; then
	# Homebrew keeps lld keg-only.
	for keg in /opt/homebrew/opt/lld/bin /opt/homebrew/opt/lld@22/bin /usr/local/opt/lld/bin; do
		[ -x "$keg/wasm-ld" ] && PATH="$keg:$PATH" && break
	done
fi
command -v wasm-ld >/dev/null || { echo "wasm-ld is not on PATH (install lld)" >&2; exit 1; }

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

KIT_REV=$(node -p "require('$SITE/alikit-catalog.json').revision")
if [ -z "$ALIKIT" ]; then
	git clone --quiet --no-checkout https://github.com/samanshaiza004/alicorn-kit.git "$WORK/kit-repo"
	ALIKIT=$WORK/kit-repo
fi
mkdir "$WORK/kit" "$WORK/alicorn"
git -C "$ALIKIT" archive "$KIT_REV" | tar -x -C "$WORK/kit"
ALICORN_REV=$(node -p "require('$WORK/kit/dependencies.lock.json').alicorn.revision")
git -C "$ALICORN" archive "$ALICORN_REV" | tar -x -C "$WORK/alicorn"

# Odin compiles *_test.odin files into ordinary builds, and some of them import
# core:testing and core:os, which js/wasm cannot build. Tests are not needed.
find "$WORK/kit" "$WORK/alicorn" -name '*_test.odin' -delete

ODIN_ROOT=$(odin root)
mkdir -p "$OUT"
odin build "$SITE/stage/kit" "-collection:alicorn=$WORK/alicorn" "-collection:alikit=$WORK/kit" \
	-target:js_wasm32 -o:size "-out:$OUT/kit.wasm" -extra-linker-flags:--export-table
cp "$ODIN_ROOT/core/sys/wasm/js/odin.js" "$OUT/odin.js"
cp "$ODIN_ROOT/vendor/wgpu/wgpu.js" "$OUT/wgpu.js"
node "$WORK/alicorn/tools/patch_odin_wgpu_js.js" "$OUT/wgpu.js"
cp "$WORK/alicorn/host/web/demand_scheduler.js" "$OUT/alicorn_demand_scheduler.js"
cp "$WORK/alicorn/host/web/accessibility_dom.js" "$OUT/alicorn_accessibility_dom.js"
cp "$WORK/alicorn/host/web/webgpu_ui_host.js" "$OUT/alicorn_webgpu_host.js"
printf 'Kit build complete: %s (alicorn-kit %.7s, Alicorn %.7s)\n' "$OUT" "$KIT_REV" "$ALICORN_REV"
