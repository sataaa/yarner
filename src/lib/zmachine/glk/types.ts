/** Callback invoked with text output from the Z-Machine */
export type OutputCallback = (text: string) => void;

/** RefStruct: used by glk_select() to pass event data back to the VM */
export class GlkRefStruct {
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
export class GlkRefBox {
	private value: any = 0;

	set_value(v: any) {
		this.value = v;
	}

	get_value() {
		return this.value;
	}
}

/** Represents a Glk window (main text buffer or status line grid) */
export interface GlkWindow {
	id: number;
	type: number;      // 3 = text buffer, 4 = text grid
	rock: number;
	str: GlkStream;    // Every window has an associated output stream
	request_line?: any;
	request_char?: boolean;
	/**
	 * linebuf: same array as request_line, exposed under the name that
	 * do_autorestore() expects to find ("obj.linebuf") so it can reconnect
	 * vm.read_data.buffer after a snapshot restore.
	 */
	linebuf?: any[];
}

/** Represents a Glk I/O stream */
export interface GlkStream {
	id: number;
	rock: number;
	writable: boolean;
	content: string;
}
