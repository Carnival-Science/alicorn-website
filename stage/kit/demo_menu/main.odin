package demo_menu

// Menu example: an anchored dropdown with checked, disabled, separator, and
// shortcut rows. The application owns command dispatch and menu contents.
//
// Run:
//   odin run examples/menu -collection:alicorn=/path/to/alicorn
//   ./out/menu_example.exe --smoke

import "core:fmt"
import alicorn "alicorn:runtime"
import ui "alicorn:ui"
import menu "alikit:menu"

App :: struct {
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

render :: proc(app: ^App, ctx: ^ui.UI) {
	if ui.panel(ctx, fill=ui.rgb(BACKDROP), key=alicorn.key_string("menu-example-root"), grow=1,
		padding=24, gap=12) {
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
	ui.run(&app, render, title="Alicorn - Menu", width=760, height=460,
		render_overlays=render_overlays, on_stop=stop, smoke=smoke)
}

// The base theme's window colour is a light lavender that the examples' light
// text cannot read against; the catalog demos sit on this dark backdrop.
BACKDROP :: 0x141A20
