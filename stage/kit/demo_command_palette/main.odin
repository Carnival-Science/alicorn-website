package demo_command_palette

import "core:fmt"
import alicorn "alicorn:runtime"
import ui "alicorn:ui"
import palette "alikit:command_palette"
import model "alikit:palette_model"

SAMPLE_ITEMS :: [4]model.Item{
	{ id=model.Item_ID(1), title="Open File", description="Browse the workspace", keywords="file browse" },
	{ id=model.Item_ID(2), title="Search in Files", description="Find text across the workspace", keywords="find grep" },
	{ id=model.Item_ID(3), title="Build Project", description="Run the configured build", keywords="compile" },
	{ id=model.Item_ID(4), title="Publish Release", description="Unavailable in this example", keywords="ship", disabled=true },
}

// Example application-owned appearance values. A real application can build
// this from its own theme or leave Appearance disabled to use Alicorn defaults.
EXAMPLE_PALETTE_APPEARANCE :: palette.Appearance{
	enabled=true,
	overlay_padding=40,
	panel_padding=16,
	panel_gap=10,
	backdrop_color=alicorn.Color{0.025, 0.035, 0.055, 0.68},
	panel_shape=alicorn.Surface_Shape{kind=.Rounded_Rectangle, corner_radius=10},
	panel_material=alicorn.MATERIAL_FLAT,
	physical_height=0,
	panel_fill=alicorn.Color{0.12, 0.14, 0.18, 1},
	backdrop_effect=alicorn.BACKDROP_NONE,
}

App :: struct {
	palette:    palette.State,
	items:      [4]model.Item,
	last_action: model.Item_ID,
	smoke:      bool,
}

render :: proc(app: ^App, ctx: ^ui.UI) {
	if alicorn.container_begin(ctx, .Container, label="command-palette-example-root",
		key=alicorn.key_string("command-palette-example-root"),
		style=alicorn.layout_style(.Column, width=-1, height=-1, grow=1, padding=16, gap=8),
		color=ui.rgb(BACKDROP)) != 0 {
		_ = ui.text(ctx, "AliKit · Command Palette", size=24)
		_ = ui.text(ctx, "Press the host command-palette shortcut, or open it with the button.")
		if !app.palette.open {
			if ui.button(ctx, "Open palette", key=alicorn.key_string("command-palette-example-open"),
				width=140, height=30, variant=.Primary) {
				_ = palette.open_palette(&app.palette, ctx.runtime)
			}
		}
		if app.last_action != 0 {
			_ = ui.text(ctx, fmt.tprintf("Last activated item ID: %d", model.item_id_value(app.last_action)))
		}
		alicorn.container_end(ctx)
	}
}

// Modal overlays describe after the ordinary root has closed, so the palette
// builds through ui.run's overlay hook rather than inside the root container.
render_overlays :: proc(app: ^App, ctx: ^ui.UI) {
	if !app.palette.open { return }
	event := palette.build(ctx, &app.palette, app.items[:],
		alicorn.key_string("alikit-example-palette"),
		palette.Options{
			title="Example Actions",
			query_accessible_name="Search example actions",
			appearance=EXAMPLE_PALETTE_APPEARANCE,
		})
	if event.kind == .Activated { app.last_action = event.item_id }
}

on_key :: proc(app: ^App, rt: ^alicorn.Runtime, key: alicorn.Application_Key) -> bool {
	if !app.palette.open && key == .Open_Command_Palette {
		_ = palette.open_palette(&app.palette, rt)
		return true
	}
	return false
}

app: App

// run starts this demo. The browser host keeps application state in
// package-global storage because ui.run returns before the app stops.
run :: proc() {
	smoke := false
	app = App{items=SAMPLE_ITEMS, smoke=smoke}
	if !palette.init(&app.palette) {
		fmt.eprintln("Could not initialize the command palette state.")
		return
	}
	ui.run(&app, render, title="AliKit Command Palette", width=760, height=520,
		on_key=on_key, render_overlays=render_overlays, smoke=smoke)
}

// The base theme's window colour is a light lavender that the examples' light
// text cannot read against; the catalog demos sit on this dark backdrop.
BACKDROP :: 0x141A20
