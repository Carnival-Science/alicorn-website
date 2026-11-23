package main

// The AliKit component catalog stage: one wasm app that carries a live demo
// for each component page. The page names the demo by setting `demo` on the
// canvas before the host starts; this reads it and runs that one example.
//
// Each demo_* package is the component's native example (alicorn-kit
// examples/<name>) with its entry point renamed. They run through the same
// `alicorn:ui` path as the native SDL_GPU build, here on the WebGPU host.

import "core:sys/wasm/js"
import demo_command_palette "demo_command_palette"
import demo_data_grid "demo_data_grid"
import demo_icon_picker "demo_icon_picker"
import demo_menu "demo_menu"
import demo_notices "demo_notices"
import demo_palette_parts "demo_palette_parts"
import demo_progress "demo_progress"
import demo_radio_group "demo_radio_group"
import demo_segmented "demo_segmented"
import demo_sidebar "demo_sidebar"
import demo_table "demo_table"
import demo_tree_view "demo_tree_view"

main :: proc() {
	buffer: [64]byte
	name := js.get_element_key_string("alicorn-canvas", "demo", buffer[:])
	switch name {
	case "command-palette": demo_command_palette.run()
	case "data-grid":       demo_data_grid.run()
	case "icon-picker":     demo_icon_picker.run()
	case "menu":            demo_menu.run()
	case "notices":         demo_notices.run()
	case "palette-parts":   demo_palette_parts.run()
	case "progress":        demo_progress.run()
	case "radio-group":     demo_radio_group.run()
	case "segmented":       demo_segmented.run()
	case "sidebar":         demo_sidebar.run()
	case "table":           demo_table.run()
	case "tree-view":       demo_tree_view.run()
	case:                   panic("the canvas names no known component demo")
	}
}
