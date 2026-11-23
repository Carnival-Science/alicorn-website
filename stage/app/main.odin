package main

// The homepage stage app: a small Alicorn program compiled for the browser.
// It is ordinary `alicorn:ui` code. The same source runs on the native host.
//
// `renders` counts how many times the description procedure has run. Alicorn
// is retained and dirty-driven, so it only moves when something changed: leave
// the stage alone and the number holds still.

import "core:fmt"
import ui "alicorn:ui"

App :: struct {
	name:    ui.Text_Buffer,
	clicks:  int,
	gain:    f32,
	grid:    bool,
	renders: int,
}

// Browser applications keep state in package-global storage: it has to outlive
// `main`, because `ui.run` returns while WebGPU starts up asynchronously.
app: App

INK   :: 0xE8ECEF
MUTED :: 0x8C97A1
WELL  :: 0x1D252D
LINE  :: 0x2E3844

render :: proc(state: ^App, ctx: ^ui.UI) {
	state.renders += 1
	if ui.panel(ctx, grow=1, padding=22, gap=14, fill=ui.rgb(0x141A20)) {
		ui.text(ctx, "Retained to run", size=28, color=ui.rgb(INK))
		ui.text(ctx, "A live Alicorn app. Touch a control, then watch what rebuilds.", color=ui.rgb(MUTED))

		if ui.row(ctx, gap=20) {
			// controls: values live in App, the description only reads them
			if ui.column(ctx, grow=1, gap=10) {
				ui.text_field(ctx, "Name", &state.name)
				ui.checkbox(ctx, "Show grid", &state.grid)
				ui.slider_f32(ctx, "Gain", &state.gain, 0, 1, step=0.05)
				if ui.row(ctx, gap=8) {
					if ui.button(ctx, "Increment", width=110) { state.clicks += 1 }
					if ui.button(ctx, "Reset", width=110) {
						state.clicks = 0
						state.gain = 0.65
						state.grid = true
					}
				}
			}

			// readout: the same state, described again
			if ui.panel(
				ctx, grow=1, padding=14, gap=6, radius=6,
				fill=ui.rgb(WELL), stroke=ui.border(1, ui.rgb(LINE)),
			) {
				ui.text(ctx, "description runs", color=ui.rgb(MUTED))
				ui.text(ctx, fmt.tprintf("%d", state.renders), size=40, color=ui.rgb(INK))
				ui.text(ctx, fmt.tprintf("hello, %s", state.name.text), color=ui.rgb(INK))
				ui.text(ctx, fmt.tprintf("clicks %d · gain %.0f%% · grid %v", state.clicks, state.gain*100, state.grid), color=ui.rgb(MUTED))
				ui.text(ctx, "Idle, the count holds still.", color=ui.rgb(MUTED))
			}
		}
	}
}

on_stop :: proc(state: ^App) {
	ui.text_buffer_destroy(&state.name)
}

main :: proc() {
	name, ok := ui.text_buffer("Alicorn")
	if !ok { panic("could not allocate the stage text buffer") }
	app = App{name=name, gain=0.65, grid=true}
	ui.run(&app, render, title="Alicorn", on_stop=on_stop)
}
