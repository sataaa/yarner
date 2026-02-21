/**
 * GameEngine — High-level interface for Z-Machine games in Yarner.
 *
 * Manages the lifecycle of a z-machine game:
 * 1. loadGame()  → creates VM + Glk, starts execution
 * 2. VM runs until it needs input, then halts (glk_select)
 * 3. sendCommand() → fills the Glk event and resumes VM
 * 4. Repeat until game ends
 *
 * Output is delivered via the onOutput() callback.
 *
 * VM execution loop:
 *   start() → run() → glk_select() → update() → wait for input
 *   sendCommand() → resume() → run() → glk_select() → update() → wait
 */

import { ZVM } from 'ifvms';
import { WebGlk } from './glk/WebGlk';
import type { OutputCallback } from './glk/types';

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
	 * The VM runs until it requests its first input (the opening prompt).
	 */
	async loadGame(gameData: ArrayBuffer): Promise<void> {
		try {
			this.glk = new WebGlk((text) => {
				if (this.outputCallback !== this.defaultCallback) {
					this.outputCallback(text);
				} else {
					this.earlyOutputBuffer.push(text);
				}
			});

			this.vm = new ZVM();
			this.vm.prepare(gameData, { Glk: this.glk });
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
	 * 1. Write the command into the VM's input buffer
	 * 2. Fill in the Glk event struct
	 * 3. Call vm.resume() to continue VM execution
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
			const charCode = command.length > 0 ? command.codePointAt(0)! : 13;
			const event = this.glk.pendingEvent;
			event.set_field(0, 2); // evtype_CharInput
			event.set_field(1, this.glk.pendingInputWindow);
			event.set_field(2, charCode);
			event.set_field(3, 0);
		} else if (this.glk.pendingInputBuffer) {
			const buffer = this.glk.pendingInputBuffer;
			for (let i = 0; i < command.length; i++) {
				buffer[i] = command.codePointAt(i)!;
			}
			const event = this.glk.pendingEvent;
			event.set_field(0, 3); // evtype_LineInput
			event.set_field(1, this.glk.pendingInputWindow);
			event.set_field(2, command.length);
			event.set_field(3, 0);
		} else {
			console.warn('No input buffer or char request pending');
			return;
		}

		this.glk.pendingEvent = null;
		this.glk.pendingInputWindow = null;
		this.glk.pendingInputBuffer = null;
		this.glk.pendingCharInput = false;

		try {
			this.vm.resume(this.glk.pendingEvent);
		} catch (error) {
			console.error('Error during VM resume:', error);
		}
	}

	/**
	 * Register callback for game output text.
	 * If the VM already produced output before this was called (e.g. game intro
	 * during init()), that buffered output is replayed immediately.
	 */
	onOutput(callback: OutputCallback): void {
		this.outputCallback = callback;
		if (this.earlyOutputBuffer.length > 0) {
			callback(this.earlyOutputBuffer.join(''));
			this.earlyOutputBuffer = [];
		}
	}

	isLoaded(): boolean {
		return this.isInitialized;
	}

	isWaitingForInput(): boolean {
		return this.glk?.pendingEvent !== null;
	}

	/**
	 * Create a full VM snapshot using ifvms.js's do_autosave mechanism.
	 * Returns null if the game is not loaded.
	 */
	saveSnapshot(): any {
		if (!this.vm || !this.isInitialized) return null;

		let capturedSnapshot: any = null;

		const prevDialog = this.vm.options?.Dialog ?? null;
		this.vm.options = this.vm.options ?? {};
		this.vm.options.Dialog = {
			streaming: false,
			autosave_write: (_sig: string, snapshot: any) => {
				capturedSnapshot = snapshot;
			}
		};

		try {
			this.vm.do_autosave(1);
		} finally {
			this.vm.options.Dialog = prevDialog;
		}

		return capturedSnapshot;
	}

	/**
	 * Restore the VM from a snapshot created by saveSnapshot().
	 *
	 * A new VM is created from scratch (re-establishing the static ROM), then
	 * do_autorestore() reloads dynamic RAM and execution state.
	 */
	async restoreFromSnapshot(gameData: ArrayBuffer, snapshot: any): Promise<void> {
		const savedCallback = this.outputCallback;
		this.destroy();

		this.glk = new WebGlk((text) => {
			if (this.outputCallback !== this.defaultCallback) {
				this.outputCallback(text);
			} else {
				this.earlyOutputBuffer.push(text);
			}
		});

		this.outputCallback = savedCallback;
		this.vm = new ZVM();

		this.vm.prepare(gameData, {
			Glk: this.glk,
			do_vm_autosave: true,
			Dialog: {
				streaming: false,
				autosave_read: () => snapshot,
				autosave_write: () => {}
			}
		});

		this.vm.init();

		// After do_autorestore the VM waits for line input but pendingInputBuffer
		// is null. Reconnect it to the linebuf that restore_allstate created.
		if (this.glk.pendingEvent && !this.glk.pendingInputBuffer && !this.glk.pendingCharInput) {
			const mainWin = this.glk.getMainWindow();
			if (mainWin) {
				this.glk.pendingInputWindow = mainWin;
				this.glk.pendingInputBuffer = mainWin.linebuf ?? this.vm.read_data?.buffer ?? [];
			}
		}

		this.isInitialized = true;
	}

	destroy(): void {
		this.vm = null;
		this.glk = null;
		this.isInitialized = false;
	}
}

export function createGameEngine(): GameEngine {
	return new GameEngine();
}
