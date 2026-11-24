package demo_palette_parts

// Palette Parts example. The result list is the copyable AliKit part; this
// host application owns the query, filtering, modal shell, and dispatch. AliKit
// owns selection by stable ID, enabled-row navigation, reveal, semantics, and
// one activation event.
//
// Run:
//   odin run examples/palette_parts -collection:alicorn=/path/to/alicorn
//   ./out/palette_parts_example.exe --smoke

import "core:fmt"
import alicorn "alicorn:runtime"
import theme "alicorn:theme"
import ui "alicorn:ui"
import model "alikit:palette_model"
import parts "alikit:palette_parts"

ITEMS := [6]model.Item{
	{id=model.Item_ID(1), title="Open File", description="Browse the workspace", keywords="file browse"},
	{id=model.Item_ID(2), title="Search in Files", description="Find text across the workspace", keywords="find grep"},
	{id=model.Item_ID(3), title="Build Project", description="Run the configured build", keywords="compile"},
	{id=model.Item_ID(4), title="Publish Release", description="Unavailable in this example", keywords="ship", disabled=true},
	{id=model.Item_ID(5), title="Open Settings", description="Adjust editor preferences", keywords="preferences options"},
	{id=model.Item_ID(6), title="Show Notifications", description="Review recent activity", keywords="alerts inbox"},
}

App :: struct {
	theme_id: alicorn.Style_Theme_ID,
	query:   ui.Text_Buffer,
	ready:   bool,
	matches: [len(ITEMS)]model.Match,
	visible: int,
	results: parts.State,
	last:    model.Item_ID,
	smoke:   bool,
}

rebuild :: proc(app: ^App) {
	app.visible, _ = model.filter(ITEMS[:], app.query.text, app.matches[:])
}

THEME_JSON :: #load("theme.json")

// register_theme installs this demo's dark palette (theme.json) so the catalog
// preview reads on its dark frame; the window colour of the base theme does not.
register_theme :: proc(app: ^App, rt: ^alicorn.Runtime) {
	registration := theme.theme_json_register(rt, string(THEME_JSON), "theme.json")
	defer theme.theme_json_register_result_destroy(&registration)
	app.theme_id = registration.theme_id
	if app.theme_id == 0 { fmt.println("demo theme registration failed:", registration.failure) }
}

initialize :: proc(app: ^App, rt: ^alicorn.Runtime) { register_theme(app, rt) }

render :: proc(app: ^App, ctx: ^ui.UI) {
	if !app.ready { return }
	rebuild(app)
	if alicorn.container_begin(ctx, .Container, label="palette-parts-example-root",
		key=alicorn.key_string("palette-parts-example-root"),
		style=alicorn.layout_style(.Column, width=-1, height=-1, grow=1, padding=24, gap=12),
		color=ui.rgb(BACKDROP)) != 0 {
		// style_environment_push needs an open container, so the palette goes on inside the root.
		root_scope := alicorn.Style_Environment_Scope{}
		if app.theme_id != 0 {
			root_scope = alicorn.style_environment_push(ctx, alicorn.Style_Environment{theme=app.theme_id})
		}
		defer if root_scope.active { alicorn.style_environment_pop(ctx, root_scope) }
		_ = ui.text(ctx, "Palette Parts", size=26)
		_ = ui.text(ctx, "The application owns the query and matching; AliKit owns the result list interaction.",
			size=13, color=alicorn.style_color(ctx, .Muted_Text))
		_ = ui.text_field(ctx, "Filter", &app.query,
			key=alicorn.key_string("palette-parts-example-query"), width=360, height=32)
		if ui.panel(ctx, key=alicorn.key_string("palette-parts-example-panel"), width=460,
			height=alicorn.LAYOUT_SIZE_FIT_CONTENT, padding=6,
			fill=alicorn.style_color(ctx, .Surface), radius=10,
			stroke=ui.border(1, alicorn.style_color(ctx, .Border), .Inside)) {
			event := parts.results(
				ctx,
				&app.results,
				ITEMS[:],
				app.matches[:app.visible],
				key=alicorn.key_string("palette-parts-example-results"),
				options=parts.Options{accessible_label="Commands", list_max_height=260},
			)
			if event.kind == .Activated {
				app.last = event.item_id
			}
		}
		status := "Click the list, then use Up/Down and Return."
		if app.last != 0 {
			status = fmt.tprintf("Activated item ID: %d", model.item_id_value(app.last))
		}
		_ = ui.text(ctx, status, size=13, color=alicorn.style_color(ctx, .Muted_Text))
		_ = ui.text(ctx, fmt.tprintf("%d of %d items match", app.visible, len(ITEMS)),
			size=12, color=alicorn.style_color(ctx, .Muted_Text))
		alicorn.container_end(ctx)
	}
}

app: App

// run starts this demo. The browser host keeps application state in
// package-global storage because ui.run returns before the app stops.
run :: proc() {
	smoke := false
	app = App{smoke=smoke}
	app.query, app.ready = ui.text_buffer("", context.allocator)
	if !app.ready {
		fmt.eprintln("Could not initialize the palette parts query buffer.")
		return
	}
	ui.run(&app, render, on_initialize=initialize, title="AliKit Palette Parts", width=640, height=460, smoke=smoke)
}

// The base theme's window colour is a light lavender that the examples' light
// text cannot read against; the catalog demos sit on this dark backdrop.
BACKDROP :: 0x141A20
