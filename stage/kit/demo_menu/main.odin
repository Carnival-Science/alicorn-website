package demo_menu

// Menu example: an anchored dropdown with checked, disabled, separator, and
// shortcut rows. The application owns command dispatch and menu contents.
//
// Run:
//   odin run examples/menu -collection:alicorn=/path/to/alicorn
//   ./out/menu_example.exe --smoke

import "core:fmt"
import alicorn "alicorn:runtime"
import theme "alicorn:theme"
import ui "alicorn:ui"
import menu "alikit:menu"

App :: struct {
	theme_id: alicorn.Style_Theme_ID,
	view:  menu.State,
	items: [6]menu.Item,
	show_grid: bool,
	status: string,
	smoke:  bool,
}

ITEMS :: [6]menu.Item{
	{key=1, label="Rename", shortcut="F2"},
	{key=2, label="Duplicate", shortcut="Ctrl+D"},
	{key=3, kind=.Separator},
	{key=4, label="Show grid", checked=true},
	{key=5, label="Archive", disabled=true},
	{key=6, label="Delete", shortcut="Del"},
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
	if ui.panel(ctx, fill=ui.rgb(BACKDROP), key=alicorn.key_string("menu-example-root"), grow=1,
		padding=24, gap=12) {
		// style_environment_push needs an open container, so the palette goes on inside the root.
		root_scope := alicorn.Style_Environment_Scope{}
		if app.theme_id != 0 {
			root_scope = alicorn.style_environment_push(ctx, alicorn.Style_Environment{theme=app.theme_id})
		}
		defer if root_scope.active { alicorn.style_environment_pop(ctx, root_scope) }
		_ = ui.text(ctx, "Menu", size=26)
		_ = ui.text(ctx, "Anchored, component-owned dropdown. Escape and outside clicks close it; focus returns to the trigger.",
			size=13, color=alicorn.style_color(ctx, .Muted_Text))
		_ = menu.trigger(ctx, &app.view, "Actions", menu.Options{accessible_label="Actions"},
			key=alicorn.key_string("menu-example-trigger"))
		_ = ui.text(ctx, app.status, size=13, color=alicorn.style_color(ctx, .Muted_Text))
	}
}

render_overlays :: proc(app: ^App, ctx: ^ui.UI) {
	visible, chosen := menu.popup_begin(ctx, &app.view, app.items[:],
		menu.Options{accessible_label="Actions"}, key=alicorn.key_string("menu-example-popup"),
		instance_id=7301)
	if !visible {
		if chosen != 0 { apply(app, chosen) }
		return
	}
	// the popup's colours go on inside it: a push needs an open container
	overlay_scope := alicorn.Style_Environment_Scope{}
	if app.theme_id != 0 {
		overlay_scope = alicorn.style_environment_push(ctx, alicorn.Style_Environment{theme=app.theme_id})
	}
	defer if overlay_scope.active { alicorn.style_environment_pop(ctx, overlay_scope) }
	for item, index in app.items {
		if menu.item(ctx, &app.view, item, index) { apply(app, item.key) }
	}
	menu.popup_end(ctx, &app.view)
}

apply :: proc(app: ^App, key: u64) {
	switch key {
	case 1: app.status = "Rename proposed."
	case 2: app.status = "Duplicate proposed."
	case 4:
		app.show_grid = !app.show_grid
		app.items[3].checked = app.show_grid
		app.status = "Grid toggled."
	case 6: app.status = "Delete proposed."
	}
}

stop :: proc(app: ^App) {
	if app.smoke {
		fmt.println("menu_smoke", "grid", app.show_grid, "idle", true)
	}
}

app: App

// run starts this demo. The browser host keeps application state in
// package-global storage because ui.run returns before the app stops.
run :: proc() {
	smoke := false
	app = App{items=ITEMS, status="Open the menu to choose a command.", smoke=smoke}
	ui.run(&app, render, on_initialize=initialize, title="Alicorn - Menu", width=760, height=460,
		render_overlays=render_overlays, on_stop=stop, smoke=smoke)
}

// The base theme's window colour is a light lavender that the examples' light
// text cannot read against; the catalog demos sit on this dark backdrop.
BACKDROP :: 0x141A20
