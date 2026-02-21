/**
 * WebGlk — Custom Glk implementation for Yarner's web interface.
 *
 * ifvms.js calls these methods during VM execution. We capture text output
 * and coordinate the input event loop between the VM and the browser UI.
 *
 * The VM runs synchronously. When it needs input, it calls glk_select()
 * which stores the event struct. Later, GameEngine calls vm.resume()
 * with the filled-in event to continue execution.
 *
 * VM execution loop:
 *   start() → run() → glk_select() → update() → wait for input
 *   sendCommand() → resume() → run() → glk_select() → update() → wait
 */

import { GlkRefStruct, GlkRefBox, type OutputCallback, type GlkWindow, type GlkStream } from './types';

export class WebGlk {
	private outputCallback: OutputCallback;
	private outputBuffer: string[] = [];

	// Window and stream tracking
	private windows: GlkWindow[] = [];
	private streams: GlkStream[] = [];
	private nextId = 1;
	private currentWindow: GlkWindow | null = null;

	// Input state: stored so GameEngine can fill the event and call vm.resume()
	pendingEvent: GlkRefStruct | null = null;
	pendingInputWindow: GlkWindow | null = null;
	pendingInputBuffer: any[] | null = null;
	pendingCharInput = false;

	constructor(outputCallback: OutputCallback) {
		this.outputCallback = outputCallback;
	}

	// ifvms.js accesses these as Glk.RefStruct / Glk.RefBox
	RefStruct = GlkRefStruct;
	RefBox = GlkRefBox;

	// ---- Capability queries ----

	glk_gestalt(id: number, _arg: number): number {
		if (id === 0x1100) return 1; // Unicode support
		return 1; // Claim support for everything to avoid fallback paths
	}

	glk_gestalt_ext(id: number, arg: number, _arr: any, _len: number): number {
		return this.glk_gestalt(id, arg);
	}

	// ---- Window management ----

	glk_window_open(
		_parent: GlkWindow | null,
		_method: number,
		_size: number,
		wintype: number,
		rock: number
	): GlkWindow {
		const stream: GlkStream = { id: this.nextId++, rock: 0, writable: true, content: '' };
		this.streams.push(stream);

		const win: GlkWindow = { id: this.nextId++, type: wintype, rock, str: stream };
		this.windows.push(win);

		if (!this.currentWindow) this.currentWindow = win;
		return win;
	}

	glk_window_close(win: GlkWindow): void {
		this.windows = this.windows.filter(w => w.id !== win.id);
		this.streams = this.streams.filter(s => s.id !== win.str.id);
		if (this.currentWindow?.id === win.id) {
			this.currentWindow = this.windows[0] || null;
		}
	}

	glk_set_window(win: GlkWindow): void {
		this.currentWindow = win;
	}

	glk_window_clear(_win: GlkWindow): void {}

	glk_window_get_size(
		_win: GlkWindow,
		widthBox: GlkRefBox | null,
		heightBox: GlkRefBox | null
	): void {
		if (widthBox) widthBox.set_value(80);
		if (heightBox) heightBox.set_value(25);
	}

	glk_window_get_stream(win: GlkWindow): GlkStream {
		return win.str;
	}

	glk_window_move_cursor(_win: GlkWindow, _x: number, _y: number): void {}

	glk_window_iterate(win: GlkWindow | null, rockBox: GlkRefBox | null): GlkWindow | null {
		if (!win) {
			const first = this.windows[0] || null;
			if (first && rockBox) rockBox.set_value(first.rock);
			return first;
		}
		const idx = this.windows.findIndex(w => w.id === win.id);
		const next = this.windows[idx + 1] || null;
		if (next && rockBox) rockBox.set_value(next.rock);
		return next;
	}

	glk_window_get_root(): GlkWindow | null {
		return this.windows[0] || null;
	}

	glk_window_get_parent(_win: GlkWindow): GlkWindow | null {
		return null;
	}

	glk_window_set_arrangement(_win: GlkWindow, _method: number, _size: number, _keywin: any): void {}

	glk_window_get_type(win: GlkWindow): number {
		return win.type;
	}

	glk_window_get_rock(win: GlkWindow): number {
		return win.rock;
	}

	// ---- Style management (no-ops) ----

	glk_stylehint_set(_wtype: number, _style: number, _hint: number, _value: number): void {}
	glk_stylehint_clear(_wtype: number, _style: number, _hint: number): void {}
	glk_set_style(_style: number): void {}
	glk_set_style_stream(_stream: GlkStream, _style: number): void {}
	garglk_set_reversevideo(_on: number): void {}
	garglk_set_reversevideo_stream(_stream: GlkStream, _on: number): void {}
	garglk_set_zcolors(_fg: number, _bg: number): void {}
	garglk_set_zcolors_stream(_stream: GlkStream, _fg: number, _bg: number): void {}

	// ---- Text output ----

	/**
	 * Primary output method. ifvms.js sends all game text through here.
	 * Buffered and flushed together on update() to produce clean output lines.
	 */
	glk_put_jstring(text: string): void {
		this.outputBuffer.push(text);
	}

	glk_put_jstring_stream(stream: GlkStream, text: string): void {
		if (stream && this.isMainWindowStream(stream)) {
			this.outputBuffer.push(text);
		}
		if (stream) stream.content += text;
	}

	glk_put_char_stream_uni(stream: GlkStream, ch: number): void {
		const text = String.fromCodePoint(ch);
		if (stream && this.isMainWindowStream(stream)) {
			this.outputBuffer.push(text);
		}
		if (stream) stream.content += text;
	}

	glk_put_buffer_stream(stream: GlkStream, buffer: number[]): void {
		if (stream) stream.content += buffer.map(c => String.fromCodePoint(c)).join('');
	}

	glk_put_string(text: string): void {
		this.outputBuffer.push(text);
	}

	glk_put_char(ch: number): void {
		this.outputBuffer.push(String.fromCharCode(ch));
	}

	glk_put_char_uni(ch: number): void {
		this.outputBuffer.push(String.fromCodePoint(ch));
	}

	private isMainWindowStream(stream: GlkStream): boolean {
		const mainWin = this.windows.find(w => w.type === 3);
		return mainWin?.str.id === stream.id;
	}

	// ---- Input handling ----

	/**
	 * VM calls this when it needs a line of text from the player.
	 * We store the buffer reference; GameEngine fills it in on sendCommand().
	 */
	glk_request_line_event_uni(win: GlkWindow, buffer: any[], _initLen: number): void {
		win.request_line = buffer;
		win.linebuf = buffer; // do_autorestore() looks for obj.linebuf
		this.pendingInputWindow = win;
		this.pendingInputBuffer = buffer;
		this.pendingCharInput = false;
	}

	glk_request_line_event(win: GlkWindow, buffer: any[], _initLen: number): void {
		this.glk_request_line_event_uni(win, buffer, _initLen);
	}

	glk_request_char_event_uni(win: GlkWindow): void {
		win.request_char = true;
		this.pendingInputWindow = win;
		this.pendingCharInput = true;
		this.pendingInputBuffer = null;
	}

	glk_request_char_event(win: GlkWindow): void {
		this.glk_request_char_event_uni(win);
	}

	glk_cancel_line_event(win: GlkWindow, _event: any): void {
		win.request_line = undefined;
	}

	glk_cancel_char_event(win: GlkWindow): void {
		win.request_char = false;
	}

	/**
	 * VM calls this when it needs to wait for an event.
	 * GameEngine fills in the event struct and calls vm.resume() to continue.
	 */
	glk_select(event: GlkRefStruct): void {
		this.pendingEvent = event;
	}

	// ---- Stream management ----

	glk_stream_iterate(stream: GlkStream | null, rockBox: GlkRefBox | null): GlkStream | null {
		if (!stream) {
			const first = this.streams[0] || null;
			if (first && rockBox) rockBox.set_value(first.rock);
			return first;
		}
		const idx = this.streams.findIndex(s => s.id === stream.id);
		const next = this.streams[idx + 1] || null;
		if (next && rockBox) rockBox.set_value(next.rock);
		return next;
	}

	glk_stream_open_memory(_buf: any[], _mode: number, rock: number): GlkStream {
		const stream: GlkStream = { id: this.nextId++, rock, writable: true, content: '' };
		this.streams.push(stream);
		return stream;
	}

	glk_stream_open_memory_uni(buf: any[], mode: number, rock: number): GlkStream {
		return this.glk_stream_open_memory(buf, mode, rock);
	}

	glk_stream_close(stream: GlkStream): { readcount: number; writecount: number } {
		this.streams = this.streams.filter(s => s.id !== stream.id);
		return { readcount: 0, writecount: stream.content.length };
	}

	glk_stream_set_current(_stream: GlkStream | null): void {}

	glk_stream_get_current(): GlkStream | null {
		return this.currentWindow?.str || null;
	}

	glk_get_char_stream_uni(_stream: GlkStream): number {
		return -1; // EOF
	}

	glk_get_line_stream_uni(_stream: GlkStream, _buffer: any[]): number {
		return 0;
	}

	// ---- File references (save/restore via Glk file API — disabled) ----

	glk_fileref_create_by_prompt(_usage: number, _mode: number, _rock: number): null { return null; }
	glk_fileref_create_by_name(_usage: number, _name: string, _rock: number): null { return null; }
	glk_fileref_create_temp(_usage: number, _rock: number): null { return null; }
	glk_fileref_destroy(_fref: any): void {}
	glk_stream_open_file(_fref: any, _mode: number, _rock: number): null { return null; }
	glk_stream_open_file_uni(_fref: any, _mode: number, _rock: number): null { return null; }

	// ---- Timer / misc ----

	glk_request_timer_events(_ms: number): void {}
	glk_set_interrupt_handler(_handler: any): void {}
	glk_tick(): void {}

	glk_char_to_lower(ch: number): number {
		return String.fromCodePoint(ch).toLowerCase().codePointAt(0) || ch;
	}

	glk_char_to_upper(ch: number): number {
		return String.fromCodePoint(ch).toUpperCase().codePointAt(0) || ch;
	}

	glk_buffer_to_lower_case_uni(buf: number[], _len: number): number { return buf.length; }
	glk_buffer_to_upper_case_uni(buf: number[], _len: number): number { return buf.length; }
	glk_buffer_to_title_case_uni(buf: number[], _len: number, _lowerrest: number): number { return buf.length; }

	/** Find the main text-buffer window (type 3) */
	getMainWindow(): GlkWindow | null {
		return this.windows.find(w => w.type === 3) ?? null;
	}

	// ---- Display update ----

	/**
	 * Called by the VM after each execution cycle.
	 * Flushes buffered output text to the UI via the output callback.
	 */
	update(): void {
		if (this.outputBuffer.length > 0) {
			this.outputCallback(this.outputBuffer.join(''));
			this.outputBuffer = [];
		}
	}

	fatal_error(error: Error | string): void {
		console.error('Z-Machine fatal error:', error);
		this.outputCallback(`\n[FATAL ERROR: ${error}]\n`);
	}

	// ---- Snapshot serialization ----

	/**
	 * Serialize Glk window/stream state for do_autosave snapshots.
	 * Called by the VM's do_autosave(); stored in snapshot.glk.
	 */
	save_allstate(): any {
		return {
			windows: this.windows.map(w => ({
				id: w.id, type: w.type, rock: w.rock,
				strId: w.str.id, strRock: w.str.rock
			})),
			streams: this.streams.map(s => ({
				id: s.id, rock: s.rock, writable: s.writable
			})),
			nextId: this.nextId,
			currentWindowId: this.currentWindow?.id ?? null,
			pendingInputWindowId: this.pendingInputWindow?.id ?? null,
			pendingCharInput: this.pendingCharInput
		};
	}

	/**
	 * Restore Glk window/stream state from a snapshot.
	 * Called by do_autorestore() before the VM RAM is restored.
	 */
	restore_allstate(state: any): void {
		if (!state) return;

		this.nextId = state.nextId;

		this.streams = (state.streams as any[]).map(s => ({
			id: s.id, rock: s.rock, writable: s.writable, content: ''
		} as GlkStream));

		// Text-buffer windows (type 3) get a fresh linebuf so do_autorestore()
		// can reconnect vm.read_data.buffer = obj.linebuf after restore.
		this.windows = (state.windows as any[]).map(w => {
			const str = this.streams.find(s => s.id === w.strId) ?? this.streams[0];
			const win: GlkWindow = { id: w.id, type: w.type, rock: w.rock, str };
			if (w.type === 3) win.linebuf = new Array(256).fill(0);
			return win;
		});

		this.currentWindow = state.currentWindowId !== null
			? (this.windows.find(w => w.id === state.currentWindowId) ?? null)
			: null;

		this.pendingInputWindow = state.pendingInputWindowId !== null
			? (this.windows.find(w => w.id === state.pendingInputWindowId) ?? null)
			: null;
		this.pendingCharInput = state.pendingCharInput ?? false;

		this.pendingEvent = null;
		this.pendingInputBuffer = null;
	}
}
