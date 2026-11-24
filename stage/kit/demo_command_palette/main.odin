package demo_command_palette

// The command palette demo: the AliKit palette's behaviour with the shell and
// the rows composed here from its public parts, the way an application would.
// AliKit keeps the query state, selection by stable ID, keyboard routing, and
// the controlled search field. This file owns the look: an integrated search
// row, grouped rows that fill their width, leading icons, right-aligned
// shortcut keycaps, and a footer.

import "core:fmt"
import alicorn "alicorn:runtime"
import theme "alicorn:theme"
import ui "alicorn:ui"
import palette "alikit:command_palette"
import model "alikit:palette_model"

FIT :: alicorn.LAYOUT_SIZE_FIT_CONTENT

PANEL_WIDTH :: 480
ROW_HEIGHT  :: 32
LABEL_NUDGE :: 0

// The application's command table. IDs are stable and nonzero; the palette
// only needs the title, the rest is presentation owned here. A group header is
// a disabled pseudo-item: the palette's list is virtual with one uniform row
// height, so a real header row is the way to keep the list's measured height
// honest (its group_begin adds a row the list does not count). Navigation skips
// disabled rows.
ITEM_COUNT :: 8

Command :: struct {
	item:     model.Item,
	group:    int,
	header:   bool,
	icon:     alicorn.Icon_ID,
	shortcut: [3]string,
}

COMMANDS :: [ITEM_COUNT]Command{
	{item={id=model.Item_ID(101), title="SUGGESTIONS", disabled=true}, group=0, header=true},
	{item={id=model.Item_ID(1), title="Open file", keywords="browse workspace"},
		group=0, icon=.File, shortcut={"Ctrl", "O", ""}},
	{item={id=model.Item_ID(2), title="Search in files", keywords="find grep"},
		group=0, icon=.Search, shortcut={"Ctrl", "Shift", "F"}},
	{item={id=model.Item_ID(3), title="Toggle sidebar", keywords="panel navigation"},
		group=0, icon=.Folder_Closed, shortcut={"Ctrl", "B", ""}},
	{item={id=model.Item_ID(102), title="COMMANDS", disabled=true}, group=1, header=true},
	{item={id=model.Item_ID(4), title="Run build", keywords="compile"},
		group=1, icon=.Terminal, shortcut={"Ctrl", "Shift", "B"}},
	{item={id=model.Item_ID(5), title="Publish release", keywords="ship", disabled=true},
		group=1, icon=.Info, shortcut={}},
	{item={id=model.Item_ID(6), title="Open settings", keywords="preferences"},
		group=1, icon=.Settings, shortcut={"Ctrl", ",", ""}},
}

App :: struct {
	theme_id:        alicorn.Style_Theme_ID,
	search_theme_id: alicorn.Style_Theme_ID,
	palette:         palette.State,
	commands:        [ITEM_COUNT]Command,
	items:           [ITEM_COUNT]model.Item,
	matches:         [ITEM_COUNT]model.Match,
	last_action:     model.Item_ID,
	smoke:           bool,
}

THEME_JSON        :: #load("theme.json")
SEARCH_THEME_JSON :: #load("search_theme.json")

register :: proc(rt: ^alicorn.Runtime, json: string, path: string) -> alicorn.Style_Theme_ID {
	registration := theme.theme_json_register(rt, json, path)
	defer theme.theme_json_register_result_destroy(&registration)
	if registration.theme_id == 0 { fmt.println("demo theme registration failed:", path, registration.failure) }
	return registration.theme_id
}

initialize :: proc(app: ^App, rt: ^alicorn.Runtime) {
	app.theme_id = register(rt, string(THEME_JSON), "theme.json")
	app.search_theme_id = register(rt, string(SEARCH_THEME_JSON), "search_theme.json")
	// Show the palette open, as the other catalog previews show their component.
	_ = palette.open_palette(&app.palette, rt)
}

root_scope_begin :: proc(app: ^App, ctx: ^ui.UI) -> alicorn.Style_Environment_Scope {
	if true || app.theme_id == 0 { return {} }
	return alicorn.style_environment_push(ctx, alicorn.Style_Environment{theme=app.theme_id})
}

// Fit-content applies to height only, so a keycap's width is estimated from
// its label (11px text is about 6.4px a character) plus its padding.
keycap_width :: proc(label: string) -> f32 { return f32(len(label))*6.4 + 12 }

// A key label drawn as a small keycap.
keycap :: proc(ctx: ^ui.UI, label: string, key: u64) {
	if alicorn.surface_begin(ctx, alicorn.surface_core_color_role(.Subtle_Surface),
		key=ui.key_u64(key),
		style=ui.layout_style(.Row, width=keycap_width(label), height=18, padding=0, align=.Center, justify=.Center),
		shape=alicorn.Surface_Shape{kind=.Rounded_Rectangle, corner_radius=4},
		fill=alicorn.style_color(ctx, .Border),
		label="keycap") != 0 {
		_ = ui.text(ctx, label, key=ui.key_u64(1), size=11,
			color=alicorn.style_color(ctx, .Muted_Text), decorative=true)
		alicorn.surface_end(ctx)
	}
}

render :: proc(app: ^App, ctx: ^ui.UI) {
	if alicorn.container_begin(ctx, .Container, label="command-palette-example-root",
		key=alicorn.key_string("command-palette-example-root"),
		style=alicorn.layout_style(.Column, width=-1, height=-1, grow=1, padding=24, gap=10, align=.Center, justify=.Center),
		color=ui.rgb(BACKDROP)) != 0 {
		scope := root_scope_begin(app, ctx)
		defer if scope.active { alicorn.style_environment_pop(ctx, scope) }
		if !app.palette.open {
			_ = ui.text(ctx, "Command palette", size=22)
			_ = ui.text(ctx, "Search, then run a command from the keyboard.",
				size=13, color=alicorn.style_color(ctx, .Muted_Text))
			if ui.button(ctx, "Open palette", key=alicorn.key_string("command-palette-example-open"),
				width=140, height=32, variant=.Primary) {
				_ = palette.open_palette(&app.palette, ctx.runtime)
			}
			if app.last_action != 0 {
				for command in app.commands {
					if command.item.id == app.last_action {
						_ = ui.text(ctx, fmt.tprintf("Ran: %s", command.item.title), size=13,
							color=alicorn.style_color(ctx, .Muted_Text))
					}
				}
			}
		}
		alicorn.container_end(ctx)
	}
}

after_frame :: proc(data: rawptr, rt: ^alicorn.Runtime) {
	state := cast(^palette.State)data
	if state != nil { state.after_frame_registered = false }
	palette.after_frame(state, rt)
}

text_changed :: proc(data: rawptr, rt: ^alicorn.Runtime, change: alicorn.Text_Change) -> bool {
	return palette.text_change(cast(^palette.State)data, rt, change)
}

// Modal overlays describe after the ordinary root has closed, so the palette
// builds through ui.run's overlay hook.
render_overlays :: proc(app: ^App, ctx: ^ui.UI) {
	state := &app.palette
	if !state.open || !state.initialized { return }
	if !ui.key_scope(ctx, alicorn.key_string("alikit-example-palette")) { return }
	if state.overlay_node != 0 {
		if queued, found := alicorn.interaction_event_next(ctx.runtime, state.overlay_node); found {
			switch queued.kind {
			case .Key:
				_, event := palette.handle_key(state, ctx.runtime, app.items[:], queued.key)
				if event.kind == .Activated { app.last_action = event.item_id }
			case .Pointer:
				_ = palette.pointer(state, ctx.runtime, queued.pointer, queued.target)
			}
			if !state.open { return }
		}
	}
	if (state.focus_pending || state.restore_focus) && !state.after_frame_registered {
		if alicorn.interaction_after_frame_register(ctx.runtime, rawptr(state), after_frame) {
			state.after_frame_registered = true
		}
	}

	// The application owns filtering; the palette's key routing reads the same
	// match slice, so hand it ours.
	state.matches = app.matches[:]
	state.matches_capacity = len(app.matches)
	state.match_count = visible_matches(app, palette.query_text(state))

	state.overlay_node = alicorn.modal_overlay_begin(
		ctx,
		alicorn.key_string("alikit-example-palette-overlay"),
		style=ui.layout_style(.Column, grow=1, padding=24, align=.Center, justify=.Start, clip=true),
		backdrop_color=alicorn.Color{0.02, 0.03, 0.04, 0.42},
	)
	if state.overlay_node == 0 { return }
	// the palette's colours go on inside the overlay: a push needs an open container
	scope := root_scope_begin(app, ctx)
	defer if scope.active { alicorn.style_environment_pop(ctx, scope) }
	_ = ui.interaction_scope(ctx, state.overlay_node, rawptr(state), alicorn.Interaction_Scope_Options{
		keys={.Escape, .Open_Command_Palette, .Up, .Down, .Return},
		composition_yield_keys={.Up, .Down, .Return},
		pointers={.Primary_Down},
		modal=true,
		on_text_change=text_changed,
	})
	state.panel_node = alicorn.surface_begin(
		ctx,
		alicorn.surface_core_color_role(.Surface),
		key=alicorn.key_string("alikit-example-palette-panel"),
		style=ui.layout_style(.Column, width=PANEL_WIDTH, height=panel_height(app), padding=0, gap=0, clip=true),
		shape=alicorn.Surface_Shape{kind=.Rounded_Rectangle, corner_radius=10},
		stroke=alicorn.Paint_Stroke{color=alicorn.style_color(ctx, .Border), width=1},
		label="alikit-example-palette-panel",
	)
	if state.panel_node != 0 {
		search_row(app, ctx)
		rule(ctx, "palette-rule-top")
		if command_count(app) == 0 {
			if ui.row(ctx, key=alicorn.key_string("palette-empty"), height=96, align=.Center, justify=.Center) {
				_ = ui.text(ctx, "No results found.", size=14, color=alicorn.style_color(ctx, .Muted_Text))
			}
		} else {
			result_list(app, ctx)
		}
		footer(app, ctx)
		alicorn.surface_end(ctx)
	}
	alicorn.modal_overlay_end(ctx)
}

// panel_height is explicit: the retained fit-content measure of a column that
// holds a virtual list lags the list's own height, so the footer ended outside
// the panel. Search row, rule, list (rows plus its inset), rule, footer.
panel_height :: proc(app: ^App) -> f32 {
	body: f32 = 96
	if command_count(app) > 0 { body = f32(app.palette.match_count)*ROW_HEIGHT + 12 }
	return 48 + 1 + body + 1 + 36
}

// visible_matches fills app.matches: for each group with at least one matching
// command, its header row, then the matching commands.
visible_matches :: proc(app: ^App, query: string) -> int {
	count := 0
	for group in 0..<2 {
		header := -1
		for command, index in app.commands {
			if command.group != group { continue }
			if command.header { header = index; continue }
			if !model.matches(command.item, query) { continue }
			if header >= 0 {
				app.matches[count] = model.Match{item_index=header}
				count += 1
				header = -1
			}
			app.matches[count] = model.Match{item_index=index}
			count += 1
		}
	}
	return count
}

// A one-pixel divider across the panel.
rule :: proc(ctx: ^ui.UI, name: string) {
	if ui.panel(ctx, key=alicorn.key_string(name), width=PANEL_WIDTH, height=1,
		fill=alicorn.style_color(ctx, .Border)) {}
}

// An integrated search row: icon, then the controlled field on the panel's own
// colour (a scoped theme removes the field's border and focus ring), with a
// placeholder drawn over it while the query is empty.
search_row :: proc(app: ^App, ctx: ^ui.UI) {
	state := &app.palette
	if ui.row(ctx, key=alicorn.key_string("palette-search-row"), height=48, padding=14, gap=10, align=.Center) {
		_ = ui.icon(ctx, .Search, key=alicorn.key_string("palette-search-icon"), size=16, color_role=.Muted_Text)
		scope := alicorn.Style_Environment_Scope{}
		if false && app.search_theme_id != 0 {
			scope = alicorn.style_environment_push(ctx, alicorn.Style_Environment{theme=app.search_theme_id})
		}
		_, _ = palette.input(ctx, state,
			palette.Options{query_height=44},
			key=alicorn.key_string("alikit-example-palette-query"))
		if scope.active { alicorn.style_environment_pop(ctx, scope) }
		if palette.query_text(state) == "" {
			_ = ui.positioned_text(ctx, "Type a command or search…", 36, 6,
				key=alicorn.key_string("palette-placeholder"), size=15,
				color=alicorn.style_color(ctx, .Muted_Text), vertical=.Middle)
		}
	}
}

result_list :: proc(app: ^App, ctx: ^ui.UI) {
	state := &app.palette
	if ui.column(ctx, key=alicorn.key_string("palette-results-inset"), height=f32(state.match_count)*ROW_HEIGHT + 12,
		padding=6, gap=0, clip=true) {
		list, opened := palette.list_begin(ctx, state, app.items[:], state.matches[:state.match_count],
			key=alicorn.key_string("alikit-example-palette-results"),
			options=palette.Options{row_height=ROW_HEIGHT, list_max_height=f32(state.match_count)*ROW_HEIGHT + 12})
		if opened {
			for index in list.first..<list.last {
				command := app.commands[state.matches[index].item_index]
				row, row_visible := palette.item_begin(ctx, &list, index)
				if !row_visible { continue }
				if command.header {
					header_row(ctx, row)
				} else {
					command_row(app, ctx, row, command)
				}
				if palette.item_end(ctx, state, &list, row) {
					app.last_action = row.item.id
					palette.close_palette(state, ctx.runtime, true)
				}
			}
			if event := palette.list_end(ctx, state, &list); event.kind == .Activated {
				app.last_action = event.item_id
				palette.close_palette(state, ctx.runtime, true)
			}
		}
		alicorn.container_end(ctx)
	}
}

// A group label, drawn in a disabled row so the list keeps one row height.
header_row :: proc(ctx: ^ui.UI, row: palette.Result_Row) {
	if ui.row(ctx, key=ui.key_u64(1), width=-1, grow=1, height=ROW_HEIGHT-2, padding=8, align=.End) {
		label := ui.text(ctx, row.item.title, key=ui.key_u64(2), size=11,
			color=alicorn.style_color(ctx, .Muted_Text), decorative=true)
		if label != 0 { _ = alicorn.visual_part_attach(ctx, label, row.owner, alicorn.visual_part_core(.Label)) }
	}
}

// One result row: the surface grows to the Button owner's full width, so the
// selected fill spans the row and the shortcut sits on the right edge.
command_row :: proc(app: ^App, ctx: ^ui.UI, row: palette.Result_Row, command: Command) {
	_ = app
	fill := alicorn.style_color(ctx, .Surface)
	if row.selected { fill = alicorn.style_color(ctx, .Selection) }
	surface := alicorn.surface_begin(
		ctx,
		alicorn.surface_core_color_role(.Surface),
		key=ui.key_u64(1),
		style=ui.layout_style(.Row, width=-1, grow=1, height=ROW_HEIGHT-2, padding=0, gap=10, align=.Center),
		shape=alicorn.Surface_Shape{kind=.Rounded_Rectangle, corner_radius=6},
		fill=fill,
		label="palette-example-row",
	)
	if surface == 0 { return }
	_ = ui.box(ctx, key=ui.key_u64(20), width=1, height=1, fill=alicorn.Color{})
	icon_role := alicorn.Style_Color_Role.Muted_Text
	text_role := alicorn.Style_Color_Role.Text
	if row.selected { icon_role = .Text }
	if row.disabled { icon_role = .Muted_Text; text_role = .Muted_Text }
	icon := ui.icon(ctx, command.icon, key=ui.key_u64(2), size=16, color_role=icon_role)
	if icon != 0 { _ = alicorn.visual_part_attach(ctx, icon, row.owner, alicorn.visual_part_core(.Icon)) }
	// Positioned text: a flow text node sits high against the icon and keycaps
	// (its line box is taller than its glyphs), so the label is placed explicitly
	// and a flex spacer pushes the shortcut to the right edge.
	label := ui.positioned_text(ctx, row.item.title, 37, 15+LABEL_NUDGE, key=ui.key_u64(3), size=14,
		color=alicorn.style_color(ctx, text_role), vertical=.Middle, max_width=PANEL_WIDTH-200)
	if label != 0 { _ = alicorn.visual_part_attach(ctx, label, row.owner, alicorn.visual_part_core(.Label)) }
	if ui.row(ctx, key=ui.key_u64(5), grow=1, height=1) {}
	if !row.disabled {
		shortcut_width: f32 = 0
		for part in command.shortcut {
			if part != "" { shortcut_width += keycap_width(part) + 4 }
		}
		if ui.row(ctx, key=ui.key_u64(4), width=shortcut_width, height=ROW_HEIGHT-2, gap=4, align=.Center) {
			for part, i in command.shortcut {
				if part != "" { keycap(ctx, part, u64(10 + i)) }
			}
		}
	}
	_ = ui.box(ctx, key=ui.key_u64(21), width=1, height=1, fill=alicorn.Color{})
	alicorn.surface_end(ctx)
}

plural :: proc(count: int, noun: string) -> string {
	if count == 1 { return fmt.tprintf("1 %s", noun) }
	return fmt.tprintf("%d %ss", count, noun)
}

command_count :: proc(app: ^App) -> int {
	count := 0
	for index in 0..<app.palette.match_count {
		if !app.commands[app.palette.matches[index].item_index].header { count += 1 }
	}
	return count
}

// The footer is positioned against the panel's bottom edge (the panel has an
// explicit height) so it does not depend on the list's measured height.
footer :: proc(app: ^App, ctx: ^ui.UI) {
	node := alicorn.container_begin(ctx, .Container, label="palette-footer",
		key=alicorn.key_string("palette-footer"),
		style=ui.layout_style(.Row, width=PANEL_WIDTH, height=36, padding=12, gap=10, align=.Center))
	if node == 0 { return }
	_ = alicorn.position_child(ctx, node, alicorn.positioned(-15, panel_height(app), vertical=.Bottom))
	_ = ui.text(ctx, plural(command_count(app), "command"), key=ui.key_u64(1), size=12,
		color=alicorn.style_color(ctx, .Muted_Text), style=ui.layout_style(.Row, width=84))
	if ui.row(ctx, key=ui.key_u64(9), grow=1, height=1) {}
	hint(ctx, "Navigate", "Up/Down", 2)
	hint(ctx, "Run", "Enter", 3)
	hint(ctx, "Close", "Esc", 4)
	alicorn.container_end(ctx)
}

hint :: proc(ctx: ^ui.UI, action, key_label: string, key: u64) {
	width := keycap_width(key_label) + 6 + f32(len(action))*6.0
	if ui.row(ctx, key=ui.key_u64(key), width=width, height=24, gap=6, align=.Center) {
		keycap(ctx, key_label, 1)
		_ = ui.text(ctx, action, key=ui.key_u64(2), size=12, color=alicorn.style_color(ctx, .Muted_Text))
	}
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
	app = App{}
	app.commands = COMMANDS
	for command, index in app.commands { app.items[index] = command.item }
	if !palette.init(&app.palette) {
		fmt.eprintln("Could not initialize the command palette state.")
		return
	}
	ui.run(&app, render, on_initialize=initialize, title="AliKit Command Palette",
		on_key=on_key, render_overlays=render_overlays)
}

// The window behind the palette.
BACKDROP :: 0x141A20
