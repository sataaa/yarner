import { describe, it, expect, vi } from 'vitest';
import { WebGlk } from './WebGlk';
import { GlkRefStruct, GlkRefBox } from './types';

// ---------------------------------------------------------------------------
// GlkRefStruct
// ---------------------------------------------------------------------------

describe('GlkRefStruct', () => {
	it('push_field / get_field', () => {
		const ref = new GlkRefStruct();
		ref.push_field(42);
		expect(ref.get_field(0)).toBe(42);
	});

	it('set_field / get_field', () => {
		const ref = new GlkRefStruct();
		ref.set_field(2, 'hello');
		expect(ref.get_field(2)).toBe('hello');
	});
});

// ---------------------------------------------------------------------------
// GlkRefBox
// ---------------------------------------------------------------------------

describe('GlkRefBox', () => {
	it('default value is 0', () => {
		expect(new GlkRefBox().get_value()).toBe(0);
	});

	it('set_value / get_value', () => {
		const box = new GlkRefBox();
		box.set_value(99);
		expect(box.get_value()).toBe(99);
	});
});

// ---------------------------------------------------------------------------
// WebGlk — output buffering
// ---------------------------------------------------------------------------

describe('WebGlk output buffering', () => {
	it('glk_put_jstring buffers text and update() flushes it', () => {
		const cb = vi.fn();
		const glk = new WebGlk(cb);
		glk.glk_put_jstring('hello');
		glk.glk_put_jstring(' world');
		expect(cb).not.toHaveBeenCalled();
		glk.update();
		expect(cb).toHaveBeenCalledWith('hello world');
	});

	it('update() with empty buffer does not call callback', () => {
		const cb = vi.fn();
		new WebGlk(cb).update();
		expect(cb).not.toHaveBeenCalled();
	});

	it('update() clears the buffer — second call does nothing', () => {
		const cb = vi.fn();
		const glk = new WebGlk(cb);
		glk.glk_put_jstring('x');
		glk.update();
		glk.update();
		expect(cb).toHaveBeenCalledTimes(1);
	});

	it('glk_put_string', () => {
		const cb = vi.fn();
		const glk = new WebGlk(cb);
		glk.glk_put_string('hi');
		glk.update();
		expect(cb).toHaveBeenCalledWith('hi');
	});

	it('glk_put_char converts char code', () => {
		const cb = vi.fn();
		const glk = new WebGlk(cb);
		glk.glk_put_char(65); // 'A'
		glk.update();
		expect(cb).toHaveBeenCalledWith('A');
	});

	it('glk_put_char_uni converts unicode code point', () => {
		const cb = vi.fn();
		const glk = new WebGlk(cb);
		glk.glk_put_char_uni(0x1f600); // 😀
		glk.update();
		expect(cb).toHaveBeenCalledWith('😀');
	});

	it('fatal_error calls callback with error message', () => {
		const cb = vi.fn();
		new WebGlk(cb).fatal_error('oops');
		expect(cb).toHaveBeenCalledWith(expect.stringContaining('oops'));
	});
});

// ---------------------------------------------------------------------------
// WebGlk — window management
// ---------------------------------------------------------------------------

describe('WebGlk window management', () => {
	it('glk_window_open creates a window of the given type', () => {
		const glk = new WebGlk(() => {});
		const win = glk.glk_window_open(null, 0, 0, 3, 0);
		expect(win.type).toBe(3);
	});

	it('first window becomes the current stream', () => {
		const glk = new WebGlk(() => {});
		const win = glk.glk_window_open(null, 0, 0, 3, 0);
		expect(glk.glk_stream_get_current()).toBe(win.str);
	});

	it('second window does not replace currentWindow', () => {
		const glk = new WebGlk(() => {});
		const win1 = glk.glk_window_open(null, 0, 0, 3, 0);
		glk.glk_window_open(null, 0, 0, 4, 0);
		expect(glk.glk_stream_get_current()).toBe(win1.str);
	});

	it('glk_set_window changes currentWindow', () => {
		const glk = new WebGlk(() => {});
		glk.glk_window_open(null, 0, 0, 3, 0);
		const win2 = glk.glk_window_open(null, 0, 0, 4, 0);
		glk.glk_set_window(win2);
		expect(glk.glk_stream_get_current()).toBe(win2.str);
	});

	it('glk_window_close removes the window', () => {
		const glk = new WebGlk(() => {});
		const win = glk.glk_window_open(null, 0, 0, 3, 0);
		glk.glk_window_close(win);
		expect(glk.glk_window_get_root()).toBeNull();
	});

	it('glk_window_close current window falls back to next remaining', () => {
		const glk = new WebGlk(() => {});
		const win1 = glk.glk_window_open(null, 0, 0, 3, 0);
		const win2 = glk.glk_window_open(null, 0, 0, 4, 0);
		glk.glk_window_close(win1);
		expect(glk.glk_stream_get_current()).toBe(win2.str);
	});

	it('getMainWindow returns the type-3 window', () => {
		const glk = new WebGlk(() => {});
		glk.glk_window_open(null, 0, 0, 4, 0);
		const main = glk.glk_window_open(null, 0, 0, 3, 0);
		expect(glk.getMainWindow()).toBe(main);
	});

	it('getMainWindow returns null when no type-3 window exists', () => {
		const glk = new WebGlk(() => {});
		glk.glk_window_open(null, 0, 0, 4, 0);
		expect(glk.getMainWindow()).toBeNull();
	});

	it('glk_window_iterate returns windows in order', () => {
		const glk = new WebGlk(() => {});
		const w1 = glk.glk_window_open(null, 0, 0, 3, 0);
		const w2 = glk.glk_window_open(null, 0, 0, 4, 0);
		expect(glk.glk_window_iterate(null, null)).toBe(w1);
		expect(glk.glk_window_iterate(w1, null)).toBe(w2);
		expect(glk.glk_window_iterate(w2, null)).toBeNull();
	});

	it('glk_window_iterate returns null when no windows exist', () => {
		expect(new WebGlk(() => {}).glk_window_iterate(null, null)).toBeNull();
	});

	it('glk_window_iterate sets rock in rockBox for first window', () => {
		const glk = new WebGlk(() => {});
		glk.glk_window_open(null, 0, 0, 3, 42);
		const box = new GlkRefBox();
		glk.glk_window_iterate(null, box);
		expect(box.get_value()).toBe(42);
	});

	it('glk_window_iterate sets rock in rockBox for second window', () => {
		const glk = new WebGlk(() => {});
		const w1 = glk.glk_window_open(null, 0, 0, 3, 10);
		glk.glk_window_open(null, 0, 0, 4, 20);
		const box = new GlkRefBox();
		glk.glk_window_iterate(w1, box);
		expect(box.get_value()).toBe(20);
	});

	it('glk_window_close non-current window leaves currentWindow unchanged', () => {
		const glk = new WebGlk(() => {});
		const win1 = glk.glk_window_open(null, 0, 0, 3, 0);
		const win2 = glk.glk_window_open(null, 0, 0, 4, 0);
		glk.glk_window_close(win2); // win1 remains current
		expect(glk.glk_stream_get_current()).toBe(win1.str);
	});

	it('glk_window_get_size fills width=80 height=25', () => {
		const glk = new WebGlk(() => {});
		const win = glk.glk_window_open(null, 0, 0, 3, 0);
		const w = new GlkRefBox();
		const h = new GlkRefBox();
		glk.glk_window_get_size(win, w, h);
		expect(w.get_value()).toBe(80);
		expect(h.get_value()).toBe(25);
	});

	it('glk_window_get_size with null boxes does not throw', () => {
		const glk = new WebGlk(() => {});
		const win = glk.glk_window_open(null, 0, 0, 3, 0);
		expect(() => glk.glk_window_get_size(win, null, null)).not.toThrow();
	});

	it('glk_window_get_type and glk_window_get_rock', () => {
		const glk = new WebGlk(() => {});
		const win = glk.glk_window_open(null, 0, 0, 3, 99);
		expect(glk.glk_window_get_type(win)).toBe(3);
		expect(glk.glk_window_get_rock(win)).toBe(99);
	});

	it('glk_window_get_root returns first window or null', () => {
		const glk = new WebGlk(() => {});
		expect(glk.glk_window_get_root()).toBeNull();
		const win = glk.glk_window_open(null, 0, 0, 3, 0);
		expect(glk.glk_window_get_root()).toBe(win);
	});

	it('glk_window_get_parent returns null', () => {
		const glk = new WebGlk(() => {});
		const win = glk.glk_window_open(null, 0, 0, 3, 0);
		expect(glk.glk_window_get_parent(win)).toBeNull();
	});

	it('glk_window_get_stream returns win.str', () => {
		const glk = new WebGlk(() => {});
		const win = glk.glk_window_open(null, 0, 0, 3, 0);
		expect(glk.glk_window_get_stream(win)).toBe(win.str);
	});
});

// ---------------------------------------------------------------------------
// WebGlk — stream output routing
// ---------------------------------------------------------------------------

describe('WebGlk stream output routing', () => {
	it('glk_put_jstring_stream to main window stream routes to output buffer', () => {
		const cb = vi.fn();
		const glk = new WebGlk(cb);
		const win = glk.glk_window_open(null, 0, 0, 3, 0);
		glk.glk_put_jstring_stream(win.str, 'text');
		glk.update();
		expect(cb).toHaveBeenCalledWith('text');
	});

	it('glk_put_jstring_stream to non-main stream does not go to output', () => {
		const cb = vi.fn();
		const glk = new WebGlk(cb);
		glk.glk_window_open(null, 0, 0, 3, 0);
		const status = glk.glk_window_open(null, 0, 0, 4, 0);
		glk.glk_put_jstring_stream(status.str, 'status');
		glk.update();
		expect(cb).not.toHaveBeenCalled();
	});

	it('glk_put_jstring_stream accumulates in stream.content', () => {
		const glk = new WebGlk(() => {});
		const win = glk.glk_window_open(null, 0, 0, 3, 0);
		glk.glk_put_jstring_stream(win.str, 'a');
		glk.glk_put_jstring_stream(win.str, 'b');
		expect(win.str.content).toBe('ab');
	});

	it('glk_put_char_stream_uni to main window routes to output', () => {
		const cb = vi.fn();
		const glk = new WebGlk(cb);
		const win = glk.glk_window_open(null, 0, 0, 3, 0);
		glk.glk_put_char_stream_uni(win.str, 65); // 'A'
		glk.update();
		expect(cb).toHaveBeenCalledWith('A');
	});

	it('glk_put_char_stream_uni to non-main stream does not buffer for output', () => {
		const cb = vi.fn();
		const glk = new WebGlk(cb);
		glk.glk_window_open(null, 0, 0, 3, 0);
		const status = glk.glk_window_open(null, 0, 0, 4, 0);
		glk.glk_put_char_stream_uni(status.str, 65);
		glk.update();
		expect(cb).not.toHaveBeenCalled();
	});

	it('glk_put_buffer_stream accumulates in stream.content', () => {
		const glk = new WebGlk(() => {});
		const win = glk.glk_window_open(null, 0, 0, 3, 0);
		glk.glk_put_buffer_stream(win.str, [72, 105]); // 'H', 'i'
		expect(win.str.content).toBe('Hi');
	});

	it('glk_put_jstring_stream with null stream is a no-op', () => {
		const cb = vi.fn();
		const glk = new WebGlk(cb);
		expect(() => glk.glk_put_jstring_stream(null as any, 'x')).not.toThrow();
		glk.update();
		expect(cb).not.toHaveBeenCalled();
	});

	it('glk_put_char_stream_uni with null stream is a no-op', () => {
		const cb = vi.fn();
		const glk = new WebGlk(cb);
		expect(() => glk.glk_put_char_stream_uni(null as any, 65)).not.toThrow();
		glk.update();
		expect(cb).not.toHaveBeenCalled();
	});

	it('glk_put_buffer_stream with null stream is a no-op', () => {
		expect(() => new WebGlk(() => {}).glk_put_buffer_stream(null as any, [65])).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// WebGlk — input state
// ---------------------------------------------------------------------------

describe('WebGlk input state', () => {
	it('glk_request_line_event_uni sets pending input state', () => {
		const glk = new WebGlk(() => {});
		const win = glk.glk_window_open(null, 0, 0, 3, 0);
		const buffer: any[] = [];
		glk.glk_request_line_event_uni(win, buffer, 0);
		expect(glk.pendingInputWindow).toBe(win);
		expect(glk.pendingInputBuffer).toBe(buffer);
		expect(glk.pendingCharInput).toBe(false);
		expect(win.linebuf).toBe(buffer); // do_autorestore reconnection
	});

	it('glk_request_line_event delegates to _uni', () => {
		const glk = new WebGlk(() => {});
		const win = glk.glk_window_open(null, 0, 0, 3, 0);
		const buffer: any[] = [];
		glk.glk_request_line_event(win, buffer, 0);
		expect(glk.pendingInputBuffer).toBe(buffer);
	});

	it('glk_request_char_event_uni sets pendingCharInput', () => {
		const glk = new WebGlk(() => {});
		const win = glk.glk_window_open(null, 0, 0, 3, 0);
		glk.glk_request_char_event_uni(win);
		expect(glk.pendingInputWindow).toBe(win);
		expect(glk.pendingCharInput).toBe(true);
		expect(glk.pendingInputBuffer).toBeNull();
	});

	it('glk_request_char_event delegates to _uni', () => {
		const glk = new WebGlk(() => {});
		const win = glk.glk_window_open(null, 0, 0, 3, 0);
		glk.glk_request_char_event(win);
		expect(glk.pendingCharInput).toBe(true);
	});

	it('glk_select stores the event struct', () => {
		const glk = new WebGlk(() => {});
		const event = new GlkRefStruct();
		glk.glk_select(event);
		expect(glk.pendingEvent).toBe(event);
	});

	it('glk_cancel_line_event clears request_line', () => {
		const glk = new WebGlk(() => {});
		const win = glk.glk_window_open(null, 0, 0, 3, 0);
		win.request_line = [];
		glk.glk_cancel_line_event(win, null);
		expect(win.request_line).toBeUndefined();
	});

	it('glk_cancel_char_event clears request_char', () => {
		const glk = new WebGlk(() => {});
		const win = glk.glk_window_open(null, 0, 0, 3, 0);
		win.request_char = true;
		glk.glk_cancel_char_event(win);
		expect(win.request_char).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// WebGlk — stream management
// ---------------------------------------------------------------------------

describe('WebGlk stream management', () => {
	it('glk_stream_iterate returns streams in order', () => {
		const glk = new WebGlk(() => {});
		const w1 = glk.glk_window_open(null, 0, 0, 3, 0);
		const w2 = glk.glk_window_open(null, 0, 0, 4, 0);
		const s1 = glk.glk_stream_iterate(null, null);
		expect(s1).toBe(w1.str);
		const s2 = glk.glk_stream_iterate(s1, null);
		expect(s2).toBe(w2.str);
		expect(glk.glk_stream_iterate(s2, null)).toBeNull();
	});

	it('glk_stream_iterate sets rockBox for first stream', () => {
		const glk = new WebGlk(() => {});
		glk.glk_stream_open_memory([], 0, 99);
		const box = new GlkRefBox();
		glk.glk_stream_iterate(null, box);
		expect(box.get_value()).toBe(99);
	});

	it('glk_stream_iterate sets rockBox for next stream', () => {
		const glk = new WebGlk(() => {});
		const s1 = glk.glk_stream_open_memory([], 0, 10);
		glk.glk_stream_open_memory([], 0, 20);
		const box = new GlkRefBox();
		glk.glk_stream_iterate(s1, box);
		expect(box.get_value()).toBe(20);
	});

	it('glk_stream_open_memory creates a stream with given rock', () => {
		const glk = new WebGlk(() => {});
		const stream = glk.glk_stream_open_memory([], 0, 7);
		expect(stream.rock).toBe(7);
	});

	it('glk_stream_open_memory_uni delegates to open_memory', () => {
		const glk = new WebGlk(() => {});
		expect(glk.glk_stream_open_memory_uni([], 0, 5).rock).toBe(5);
	});

	it('glk_stream_close removes stream and returns writecount', () => {
		const glk = new WebGlk(() => {});
		const stream = glk.glk_stream_open_memory([], 0, 0);
		stream.content = 'hello';
		const result = glk.glk_stream_close(stream);
		expect(result.writecount).toBe(5);
		expect(result.readcount).toBe(0);
		expect(glk.glk_stream_iterate(null, null)).toBeNull();
	});

	it('glk_stream_get_current returns null when no window is open', () => {
		expect(new WebGlk(() => {}).glk_stream_get_current()).toBeNull();
	});

	it('glk_get_char_stream_uni returns -1 (EOF)', () => {
		const glk = new WebGlk(() => {});
		const win = glk.glk_window_open(null, 0, 0, 3, 0);
		expect(glk.glk_get_char_stream_uni(win.str)).toBe(-1);
	});

	it('glk_get_line_stream_uni returns 0', () => {
		const glk = new WebGlk(() => {});
		const win = glk.glk_window_open(null, 0, 0, 3, 0);
		expect(glk.glk_get_line_stream_uni(win.str, [])).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// WebGlk — save_allstate / restore_allstate
// ---------------------------------------------------------------------------

describe('WebGlk save_allstate / restore_allstate', () => {
	it('save_allstate with no windows captures null currentWindowId', () => {
		const state = new WebGlk(() => {}).save_allstate();
		expect(state.currentWindowId).toBeNull();
		expect(state.windows).toHaveLength(0);
	});

	it('save_allstate captures windows and streams', () => {
		const glk = new WebGlk(() => {});
		glk.glk_window_open(null, 0, 0, 3, 10);
		const state = glk.save_allstate();
		expect(state.windows).toHaveLength(1);
		expect(state.windows[0].rock).toBe(10);
		expect(state.streams).toHaveLength(1);
	});

	it('restore_allstate with null is a no-op', () => {
		expect(() => new WebGlk(() => {}).restore_allstate(null)).not.toThrow();
	});

	it('roundtrip: save then restore recreates windows', () => {
		const glk = new WebGlk(() => {});
		glk.glk_window_open(null, 0, 0, 3, 10);
		glk.glk_window_open(null, 0, 0, 4, 20);
		const state = glk.save_allstate();

		const glk2 = new WebGlk(() => {});
		glk2.restore_allstate(state);
		expect(glk2.glk_window_get_root()?.type).toBe(3);
		expect(glk2.glk_window_get_root()?.rock).toBe(10);
	});

	it('type-3 window gets a 256-element linebuf after restore', () => {
		const glk = new WebGlk(() => {});
		glk.glk_window_open(null, 0, 0, 3, 0);
		const state = glk.save_allstate();

		const glk2 = new WebGlk(() => {});
		glk2.restore_allstate(state);
		expect(glk2.getMainWindow()?.linebuf).toHaveLength(256);
	});

	it('pendingInputWindowId is captured and restored', () => {
		const glk = new WebGlk(() => {});
		const win = glk.glk_window_open(null, 0, 0, 3, 0);
		glk.glk_request_line_event_uni(win, [], 0);
		const state = glk.save_allstate();
		expect(state.pendingInputWindowId).toBe(win.id);

		const glk2 = new WebGlk(() => {});
		glk2.restore_allstate(state);
		expect(glk2.pendingInputWindow).not.toBeNull();
	});

	it('pendingInputWindowId=null when no input is pending', () => {
		const glk = new WebGlk(() => {});
		glk.glk_window_open(null, 0, 0, 3, 0);
		const state = glk.save_allstate();
		expect(state.pendingInputWindowId).toBeNull();

		const glk2 = new WebGlk(() => {});
		glk2.restore_allstate(state);
		expect(glk2.pendingInputWindow).toBeNull();
	});

	it('restore_allstate with explicit null currentWindowId sets null', () => {
		const glk = new WebGlk(() => {});
		glk.restore_allstate({
			windows: [], streams: [], nextId: 1,
			currentWindowId: null, pendingInputWindowId: null, pendingCharInput: false
		});
		expect(glk.glk_stream_get_current()).toBeNull();
	});

	it('restore_allstate uses streams[0] as fallback when strId not found', () => {
		const glk = new WebGlk(() => {});
		// Window references strId=999 which doesn't exist — falls back to streams[0]
		glk.restore_allstate({
			windows: [{ id: 2, type: 3, rock: 0, strId: 999, strRock: 0 }],
			streams: [{ id: 1, rock: 0, writable: true }],
			nextId: 3, currentWindowId: null, pendingInputWindowId: null, pendingCharInput: false
		});
		expect(glk.glk_window_get_root()?.str).toBeDefined();
	});

	it('restore_allstate with currentWindowId not matching any window falls back to null', () => {
		const glk = new WebGlk(() => {});
		glk.restore_allstate({
			windows: [{ id: 1, type: 3, rock: 0, strId: 2, strRock: 0 }],
			streams: [{ id: 2, rock: 0, writable: true }],
			nextId: 3, currentWindowId: 999, pendingInputWindowId: null, pendingCharInput: false
		});
		expect(glk.glk_stream_get_current()).toBeNull();
	});

	it('restore_allstate with pendingInputWindowId not matching any window falls back to null', () => {
		const glk = new WebGlk(() => {});
		glk.restore_allstate({
			windows: [{ id: 1, type: 3, rock: 0, strId: 2, strRock: 0 }],
			streams: [{ id: 2, rock: 0, writable: true }],
			nextId: 3, currentWindowId: null, pendingInputWindowId: 999, pendingCharInput: false
		});
		expect(glk.pendingInputWindow).toBeNull();
	});

	it('restore_allstate with missing pendingCharInput defaults to false', () => {
		const glk = new WebGlk(() => {});
		glk.restore_allstate({
			windows: [], streams: [], nextId: 1,
			currentWindowId: null, pendingInputWindowId: null
			// pendingCharInput absent → ?? false
		});
		expect(glk.pendingCharInput).toBe(false);
	});

	it('restore_allstate resets pendingEvent and pendingInputBuffer', () => {
		const glk = new WebGlk(() => {});
		glk.glk_window_open(null, 0, 0, 3, 0);
		const state = glk.save_allstate();
		glk.restore_allstate(state);
		expect(glk.pendingEvent).toBeNull();
		expect(glk.pendingInputBuffer).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// WebGlk — capabilities and misc
// ---------------------------------------------------------------------------

describe('WebGlk capabilities and misc', () => {
	it('glk_gestalt returns 1 for any query', () => {
		const glk = new WebGlk(() => {});
		expect(glk.glk_gestalt(0, 0)).toBe(1);
		expect(glk.glk_gestalt(0x1100, 0)).toBe(1);
	});

	it('glk_gestalt_ext delegates to glk_gestalt', () => {
		expect(new WebGlk(() => {}).glk_gestalt_ext(0, 0, null, 0)).toBe(1);
	});

	it('glk_char_to_lower converts uppercase', () => {
		const glk = new WebGlk(() => {});
		expect(glk.glk_char_to_lower('A'.codePointAt(0)!)).toBe('a'.codePointAt(0));
	});

	it('glk_char_to_lower with code point 0 uses || ch fallback', () => {
		// codePointAt(0) returns 0 for null char, which is falsy — triggers || ch
		expect(new WebGlk(() => {}).glk_char_to_lower(0)).toBe(0);
	});

	it('glk_char_to_upper converts lowercase', () => {
		const glk = new WebGlk(() => {});
		expect(glk.glk_char_to_upper('a'.codePointAt(0)!)).toBe('A'.codePointAt(0));
	});

	it('glk_char_to_upper with code point 0 uses || ch fallback', () => {
		expect(new WebGlk(() => {}).glk_char_to_upper(0)).toBe(0);
	});

	it('glk_buffer_to_*_case_uni return buf.length', () => {
		const glk = new WebGlk(() => {});
		expect(glk.glk_buffer_to_lower_case_uni([1, 2], 2)).toBe(2);
		expect(glk.glk_buffer_to_upper_case_uni([1], 1)).toBe(1);
		expect(glk.glk_buffer_to_title_case_uni([1], 1, 0)).toBe(1);
	});

	it('no-op methods do not throw', () => {
		const glk = new WebGlk(() => {});
		const win = glk.glk_window_open(null, 0, 0, 3, 0);
		expect(() => {
			glk.glk_window_clear(win);
			glk.glk_window_move_cursor(win, 0, 0);
			glk.glk_window_set_arrangement(win, 0, 0, null);
			glk.glk_stylehint_set(0, 0, 0, 0);
			glk.glk_stylehint_clear(0, 0, 0);
			glk.glk_set_style(0);
			glk.glk_set_style_stream(win.str, 0);
			glk.garglk_set_reversevideo(0);
			glk.garglk_set_reversevideo_stream(win.str, 0);
			glk.garglk_set_zcolors(0, 0);
			glk.garglk_set_zcolors_stream(win.str, 0, 0);
			glk.glk_fileref_create_by_prompt(0, 0, 0);
			glk.glk_fileref_create_by_name(0, '', 0);
			glk.glk_fileref_create_temp(0, 0);
			glk.glk_fileref_destroy(null);
			glk.glk_stream_open_file(null, 0, 0);
			glk.glk_stream_open_file_uni(null, 0, 0);
			glk.glk_request_timer_events(0);
			glk.glk_set_interrupt_handler(null);
			glk.glk_tick();
			glk.glk_stream_set_current(null);
			glk.glk_stream_set_current(win.str);
		}).not.toThrow();
	});
});
