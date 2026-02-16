/**
 * ZVM Wrapper - Z-Machine interpreter wrapper for Yarner
 *
 * Wraps ifvms.js with a custom Glk implementation for web-based play.
 *
 * Architecture:
 * - ifvms.js runs the Z-Machine VM synchronously until it needs input
 * - The VM communicates output/input through the Glk interface
 * - Our WebGlk captures text output and coordinates user input
 * - The VM execution loop: start() → run() → glk_select() → update() → wait
 *   Then on input: resume() → run() → glk_select() → update() → wait
 *
 * Key Glk methods used by ifvms.js (from analysis of its source):
 * - glk_put_jstring(): Primary text output
 * - glk_request_line_event_uni(): Request line input from player
 * - glk_request_char_event_uni(): Request single char input
 * - glk_select(): Block VM until event arrives
 * - update(): Flush buffered output to screen
 * - glk_window_open/close/clear: Window management (main + status)
 * - glk_stylehint_set/clear: Style configuration
 * - glk_gestalt(): Capability queries
 */

import { ZVM } from 'ifvms';

type OutputCallback = (text: string) => void;

// ---- Glk helper structures required by ifvms.js ----

/** RefStruct: used by glk_select() to pass event data back to the VM */
class GlkRefStruct {
  private fields: any[] = [];

  push_field(value: any) {
    this.fields.push(value);
  }

  set_field(index: number, value: any) {
    this.fields[index] = value;
  }

  get_field(index: number) {
    return this.fields[index];
  }
}

/** RefBox: used by glk_window_get_size() and similar to return values by reference */
class GlkRefBox {
  private value: any = 0;

  set_value(v: any) {
    this.value = v;
  }

  get_value() {
    return this.value;
  }
}

/** Represents a Glk window (main text buffer or status line grid) */
interface GlkWindow {
  id: number;
  type: number;       // 3 = text buffer, 4 = text grid
  rock: number;
  str: GlkStream;     // Every window has an associated output stream
  request_line?: any;  // Pending line input request buffer
  request_char?: boolean; // Pending char input request
}

/** Represents a Glk I/O stream */
interface GlkStream {
  id: number;
  rock: number;
  writable: boolean;
  content: string;     // Accumulated text (for file streams)
}

/**
 * WebGlk - Custom Glk implementation for Yarner's web interface.
 *
 * ifvms.js calls these methods during VM execution. We capture text output
 * and coordinate the input event loop between the VM and the browser UI.
 *
 * The VM runs synchronously. When it needs input, it calls glk_select()
 * which stores the event struct. Later, GameEngine calls vm.resume()
 * with the filled-in event to continue execution.
 */
class WebGlk {
  private outputCallback: OutputCallback;
  private outputBuffer: string[] = [];

  // Window tracking
  private windows: GlkWindow[] = [];
  private streams: GlkStream[] = [];
  private nextId = 1;
  private currentWindow: GlkWindow | null = null;

  // Input state: stored so GameEngine can fill in the event and call vm.resume()
  pendingEvent: GlkRefStruct | null = null;
  pendingInputWindow: GlkWindow | null = null;
  pendingInputBuffer: any[] | null = null;  // Buffer for line input
  pendingCharInput = false;

  constructor(outputCallback: OutputCallback) {
    this.outputCallback = outputCallback;
  }

  // ---- Structures required by ifvms.js ----
  // These must be constructor functions accessible as Glk.RefStruct / Glk.RefBox
  RefStruct = GlkRefStruct;
  RefBox = GlkRefBox;

  // ---- Capability queries ----

  /** ifvms.js queries capabilities (color support, unicode, etc.) */
  glk_gestalt(id: number, _arg: number): number {
    // gestalt IDs used by ifvms:
    // 0x0B00 (2816) = garglk_gestalt_Text2Colors → return 1 to claim color support
    // Others: return safe defaults
    if (id === 0x1100) return 1; // Unicode support
    return 1; // Claim support for everything to avoid fallback paths
  }

  glk_gestalt_ext(id: number, arg: number, _arr: any, _len: number): number {
    return this.glk_gestalt(id, arg);
  }

  // ---- Window management ----

  /**
   * Open a new Glk window. ifvms.js creates:
   * - Main window (type 3, text buffer) for game prose
   * - Status window (type 4, text grid) for the status line
   * - Upper window (type 4, text grid) for split-window effects
   */
  glk_window_open(
    _parent: GlkWindow | null,
    _method: number,
    _size: number,
    wintype: number,
    rock: number
  ): GlkWindow {
    const stream: GlkStream = {
      id: this.nextId++,
      rock: 0,
      writable: true,
      content: ''
    };
    this.streams.push(stream);

    const win: GlkWindow = {
      id: this.nextId++,
      type: wintype,
      rock: rock,
      str: stream
    };
    this.windows.push(win);

    if (!this.currentWindow) {
      this.currentWindow = win;
    }
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

  glk_window_clear(_win: GlkWindow): void {
    // Could clear the display; for now no-op (status line refreshes naturally)
  }

  /**
   * Returns window dimensions. ifvms.js uses this for status line layout.
   * We report a standard 80x25 terminal size.
   */
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

  glk_window_move_cursor(_win: GlkWindow, _x: number, _y: number): void {
    // Status line cursor positioning — no-op for our text-only UI
  }

  /** Iterate over windows (used by VM for cleanup). Returns null to signal end. */
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

  glk_window_set_arrangement(_win: GlkWindow, _method: number, _size: number, _keywin: any): void {
    // No-op for simplified layout
  }

  glk_window_get_type(win: GlkWindow): number {
    return win.type;
  }

  glk_window_get_rock(win: GlkWindow): number {
    return win.rock;
  }

  // ---- Style management ----
  // ifvms.js calls these during window setup; safe to no-op

  glk_stylehint_set(_wtype: number, _style: number, _hint: number, _value: number): void {}
  glk_stylehint_clear(_wtype: number, _style: number, _hint: number): void {}
  glk_set_style(_style: number): void {}
  glk_set_style_stream(_stream: GlkStream, _style: number): void {}

  // Gargoyle extensions for colors/reverse video
  garglk_set_reversevideo(_on: number): void {}
  garglk_set_reversevideo_stream(_stream: GlkStream, _on: number): void {}
  garglk_set_zcolors(_fg: number, _bg: number): void {}
  garglk_set_zcolors_stream(_stream: GlkStream, _fg: number, _bg: number): void {}

  // ---- Text output ----

  /**
   * Primary output method. ifvms.js sends all game text through here.
   * We buffer it and flush on update().
   */
  glk_put_jstring(text: string): void {
    this.outputBuffer.push(text);
  }

  /** Output to a specific stream (used for transcripts, status line) */
  glk_put_jstring_stream(stream: GlkStream, text: string): void {
    if (stream && this.isMainWindowStream(stream)) {
      this.outputBuffer.push(text);
    }
    // Otherwise accumulate in stream content (for transcripts)
    if (stream) {
      stream.content += text;
    }
  }

  glk_put_char_stream_uni(stream: GlkStream, ch: number): void {
    const text = String.fromCodePoint(ch);
    if (stream && this.isMainWindowStream(stream)) {
      this.outputBuffer.push(text);
    }
    if (stream) {
      stream.content += text;
    }
  }

  glk_put_buffer_stream(stream: GlkStream, buffer: number[]): void {
    const text = buffer.map(c => String.fromCodePoint(c)).join('');
    if (stream) {
      stream.content += text;
    }
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

  /** Check if a stream belongs to the main (lower/prose) window */
  private isMainWindowStream(stream: GlkStream): boolean {
    const mainWin = this.windows.find(w => w.type === 3); // text buffer
    return mainWin?.str.id === stream.id;
  }

  // ---- Input handling ----

  /**
   * VM calls this when it needs a line of text from the player.
   * We store the buffer reference and wait; GameEngine will fill it in later.
   */
  glk_request_line_event_uni(win: GlkWindow, buffer: any[], _initLen: number): void {
    win.request_line = buffer;
    this.pendingInputWindow = win;
    this.pendingInputBuffer = buffer;
    this.pendingCharInput = false;
  }

  glk_request_line_event(win: GlkWindow, buffer: any[], _initLen: number): void {
    this.glk_request_line_event_uni(win, buffer, _initLen);
  }

  /** VM calls this when it needs a single keypress */
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
   * glk_select: called by the VM when it needs to wait for an event.
   * We store the event struct reference. The GameEngine will later fill it
   * and call vm.resume() to continue.
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

  glk_stream_open_memory(buf: any[], _mode: number, rock: number): GlkStream {
    const stream: GlkStream = {
      id: this.nextId++,
      rock,
      writable: true,
      content: ''
    };
    this.streams.push(stream);
    return stream;
  }

  glk_stream_open_memory_uni(buf: any[], _mode: number, rock: number): GlkStream {
    return this.glk_stream_open_memory(buf, _mode, rock);
  }

  glk_stream_close(stream: GlkStream): { readcount: number; writecount: number } {
    this.streams = this.streams.filter(s => s.id !== stream.id);
    return { readcount: 0, writecount: stream.content.length };
  }

  glk_stream_set_current(stream: GlkStream | null): void {
    // Used for output redirection; our implementation routes via glk_put_jstring
  }

  glk_stream_get_current(): GlkStream | null {
    return this.currentWindow?.str || null;
  }

  glk_get_char_stream_uni(_stream: GlkStream): number {
    return -1; // EOF
  }

  glk_get_line_stream_uni(_stream: GlkStream, _buffer: any[]): number {
    return 0; // No data
  }

  // ---- File references (save/restore) ----
  // Minimal stubs — save/restore not yet supported in Yarner MVP

  glk_fileref_create_by_prompt(
    _usage: number,
    _mode: number,
    _rock: number
  ): null {
    // Return null to signal "user cancelled" — disables save/restore for now
    return null;
  }

  glk_fileref_create_by_name(_usage: number, _name: string, _rock: number): null {
    return null;
  }

  glk_fileref_create_temp(_usage: number, _rock: number): null {
    return null;
  }

  glk_fileref_destroy(_fref: any): void {}

  glk_stream_open_file(_fref: any, _mode: number, _rock: number): null {
    return null;
  }

  glk_stream_open_file_uni(_fref: any, _mode: number, _rock: number): null {
    return null;
  }

  // ---- Timer (not used in MVP) ----

  glk_request_timer_events(_ms: number): void {}

  // ---- Miscellaneous ----

  glk_set_interrupt_handler(_handler: any): void {}

  glk_tick(): void {}

  glk_char_to_lower(ch: number): number {
    return String.fromCodePoint(ch).toLowerCase().codePointAt(0) || ch;
  }

  glk_char_to_upper(ch: number): number {
    return String.fromCodePoint(ch).toUpperCase().codePointAt(0) || ch;
  }

  glk_buffer_to_lower_case_uni(buf: number[], _len: number): number {
    return buf.length;
  }

  glk_buffer_to_upper_case_uni(buf: number[], _len: number): number {
    return buf.length;
  }

  glk_buffer_to_title_case_uni(buf: number[], _len: number, _lowerrest: number): number {
    return buf.length;
  }

  /** State serialization for autosave (not yet implemented) */
  save_allstate(): any {
    return null;
  }

  restore_allstate(_state: any): void {}

  // ---- Display update ----

  /**
   * Called by the VM after each execution cycle (start/resume).
   * Flushes all buffered output text to the UI via the output callback.
   */
  update(): void {
    if (this.outputBuffer.length > 0) {
      const text = this.outputBuffer.join('');
      this.outputCallback(text);
      this.outputBuffer = [];
    }
  }

  /** Fatal VM error — display to user */
  fatal_error(error: Error | string): void {
    console.error('Z-Machine fatal error:', error);
    this.outputCallback(`\n[FATAL ERROR: ${error}]\n`);
  }
}

/**
 * GameEngine - High-level interface for Z-Machine games in Yarner.
 *
 * Manages the lifecycle of a z-machine game:
 * 1. loadGame() → creates VM + Glk, starts execution
 * 2. VM runs until it needs input, then halts
 * 3. sendCommand() → fills in the Glk event and resumes VM
 * 4. Repeat until game ends
 *
 * Output is delivered via the onOutput() callback.
 */
export class GameEngine {
  private vm: any;
  private glk: WebGlk | null = null;
  private defaultCallback: OutputCallback = () => {};
  private outputCallback: OutputCallback = this.defaultCallback;
  private isInitialized = false;
  // Buffer for output produced before any callback is registered (e.g. game intro)
  private earlyOutputBuffer: string[] = [];

  /**
   * Load and start a Z-Machine game file.
   * The VM will run until it requests its first input (the opening prompt).
   */
  async loadGame(gameData: ArrayBuffer): Promise<void> {
    try {
      // Create our custom Glk interface that captures output.
      // During init(), output goes to earlyOutputBuffer if no real callback yet.
      this.glk = new WebGlk((text) => {
        if (this.outputCallback !== this.defaultCallback) {
          this.outputCallback(text);
        } else {
          this.earlyOutputBuffer.push(text);
        }
      });

      // Instantiate ifvms.js Z-Machine VM
      this.vm = new ZVM();

      // prepare() loads the story file and links the Glk layer
      this.vm.prepare(gameData, {
        Glk: this.glk
      });

      // init() starts execution: VM runs synchronously until first input request.
      // After this, glk.pendingEvent will hold the event struct waiting to be filled.
      this.vm.init();

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to load game:', error);
      throw new Error(`Failed to load game: ${error}`);
    }
  }

  /**
   * Send a player command to the running game.
   *
   * How it works:
   * 1. Write the command text into the VM's input buffer
   * 2. Fill in the Glk event struct with event type and length
   * 3. Call vm.resume() to continue VM execution
   * 4. VM processes input, produces output, then halts at next input request
   */
  sendCommand(command: string): void {
    if (!this.isInitialized || !this.vm || !this.glk) {
      throw new Error('Game not loaded');
    }

    if (!this.glk.pendingEvent) {
      console.warn('No pending input request from VM');
      return;
    }

    if (this.glk.pendingCharInput) {
      // Single character input (rare, used by some games for [MORE] prompts)
      const charCode = command.length > 0 ? command.codePointAt(0)! : 13; // Enter
      const event = this.glk.pendingEvent;
      event.set_field(0, 2);  // evtype_CharInput = 2
      event.set_field(1, this.glk.pendingInputWindow);
      event.set_field(2, charCode);
      event.set_field(3, 0);
    } else if (this.glk.pendingInputBuffer) {
      // Line input (normal command entry)
      const buffer = this.glk.pendingInputBuffer;

      // Write command characters into the VM's buffer
      for (let i = 0; i < command.length; i++) {
        buffer[i] = command.codePointAt(i)!;
      }

      // Fill in the event struct: [type, window, length, terminator_key]
      const event = this.glk.pendingEvent;
      event.set_field(0, 3);  // evtype_LineInput = 3
      event.set_field(1, this.glk.pendingInputWindow);
      event.set_field(2, command.length);
      event.set_field(3, 0);  // No special terminator
    } else {
      console.warn('No input buffer or char request pending');
      return;
    }

    // Clear pending state before resuming (VM will set new ones)
    this.glk.pendingEvent = null;
    this.glk.pendingInputWindow = null;
    this.glk.pendingInputBuffer = null;
    this.glk.pendingCharInput = false;

    // Resume VM execution — it will run until next input request
    try {
      this.vm.resume(this.glk.pendingEvent);
    } catch (error) {
      console.error('Error during VM resume:', error);
    }
  }

  /**
   * Register callback for game output text.
   * If the VM already produced output before this was called (e.g. the game
   * intro during init()), that buffered output is replayed immediately.
   */
  onOutput(callback: OutputCallback): void {
    this.outputCallback = callback;

    // Replay any output that was produced before this callback was registered
    if (this.earlyOutputBuffer.length > 0) {
      const buffered = this.earlyOutputBuffer.join('');
      this.earlyOutputBuffer = [];
      callback(buffered);
    }
  }

  /** Check if a game is loaded and running */
  isLoaded(): boolean {
    return this.isInitialized;
  }

  /** Check if the VM is waiting for player input */
  isWaitingForInput(): boolean {
    return this.glk?.pendingEvent !== null;
  }

  /** Restart the current game */
  restart(): void {
    if (this.vm && this.vm.restart) {
      this.vm.restart();
    }
  }

  /** Get current game state (placeholder for future save support) */
  getGameState(): any {
    if (!this.vm) return null;
    return { initialized: this.isInitialized };
  }

  /** Clean up all resources */
  destroy(): void {
    this.vm = null;
    this.glk = null;
    this.isInitialized = false;
  }
}

/** Convenience factory function */
export function createGameEngine(): GameEngine {
  return new GameEngine();
}
