import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';

// Mock the z-machine engine — ifvms.js relies on browser APIs unavailable in Node.
// The factory returns a fresh mock object on every createGameEngine() call,
// so each loadGame() call gets its own isolated mock engine instance.
vi.mock('$lib/zmachine', () => ({
	createGameEngine: vi.fn(() => ({
		onOutput: vi.fn(),
		loadGame: vi.fn().mockResolvedValue(undefined),
		sendCommand: vi.fn(),
		saveSnapshot: vi.fn().mockReturnValue({ data: 'mock-snapshot' }),
		restoreFromSnapshot: vi.fn().mockResolvedValue(undefined),
		destroy: vi.fn()
	}))
}));

// Mock persistence — IndexedDB is not needed for these store unit tests.
vi.mock('$lib/stores/aiPersistence', () => ({
	getSaveSlots: vi.fn().mockResolvedValue({}),
	writeSaveSlot: vi.fn().mockResolvedValue(undefined),
	deleteSaveSlot: vi.fn().mockResolvedValue(undefined)
}));

import { createGameEngine } from '$lib/zmachine';
import { writeSaveSlot, deleteSaveSlot, getSaveSlots } from '$lib/stores/aiPersistence';
import {
	gameState,
	isGameLoaded,
	currentGameName,
	gameEngine,
	addOutput,
	clearHistory,
	sendCommand,
	loadGame,
	restartGame,
	saveGame,
	loadFromSaveSlot,
	unloadGame,
	getSaveSlotList,
	removeSaveSlot,
	type SaveSlot
} from './gameState';

// Reset store state before each test so tests are fully isolated.
beforeEach(() => {
	unloadGame();
	vi.mocked(writeSaveSlot).mockClear();
	vi.mocked(deleteSaveSlot).mockClear();
	vi.mocked(getSaveSlots).mockClear();
});

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe('initial state', () => {
	it('isGameLoaded is false', () => {
		expect(get(isGameLoaded)).toBe(false);
	});

	it('currentGameName is an empty string', () => {
		expect(get(currentGameName)).toBe('');
	});

	it('gameHistory is empty', () => {
		expect(get(gameState).gameHistory).toEqual([]);
	});

	it('gameEngine derived store returns null when no game is loaded', () => {
		expect(get(gameEngine)).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// addOutput
// ---------------------------------------------------------------------------

describe('addOutput', () => {
	it('appends a line to gameHistory', () => {
		addOutput('West of House');
		expect(get(gameState).gameHistory).toEqual(['West of House']);
	});

	it('appends multiple lines in order', () => {
		addOutput('> look');
		addOutput('You are standing in an open field.');
		expect(get(gameState).gameHistory).toEqual([
			'> look',
			'You are standing in an open field.'
		]);
	});
});

// ---------------------------------------------------------------------------
// clearHistory
// ---------------------------------------------------------------------------

describe('clearHistory', () => {
	it('empties gameHistory', () => {
		addOutput('some text');
		addOutput('more text');
		clearHistory();
		expect(get(gameState).gameHistory).toEqual([]);
	});

	it('is a no-op on an already empty history', () => {
		clearHistory();
		expect(get(gameState).gameHistory).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// loadGame
// ---------------------------------------------------------------------------

describe('loadGame', () => {
	it('marks the game as loaded', async () => {
		await loadGame('zork.z5', new ArrayBuffer(8));
		expect(get(isGameLoaded)).toBe(true);
	});

	it('strips the file extension from the game name', async () => {
		await loadGame('adventure.z5', new ArrayBuffer(4));
		expect(get(currentGameName)).toBe('adventure');
	});

	it('stores a pristine clone of gameData for future save/restore', async () => {
		const data = new ArrayBuffer(16);
		await loadGame('zork.z5', data);
		const stored = get(gameState).gameData!;
		expect(stored).not.toBe(data); // must be a clone (ifvms mutates in-place)
		expect(stored.byteLength).toBe(data.byteLength);
	});

	it('captures engine output via the onOutput callback', async () => {
		// Override the factory to deliver output synchronously during loadGame
		vi.mocked(createGameEngine).mockImplementationOnce(() => ({
			onOutput: (cb: (text: string) => void) => { cb('intro text'); },
			loadGame: vi.fn().mockResolvedValue(undefined),
			sendCommand: vi.fn(),
			saveSnapshot: vi.fn().mockReturnValue({}),
			restoreFromSnapshot: vi.fn().mockResolvedValue(undefined),
			destroy: vi.fn()
		}));

		await loadGame('zork.z5', new ArrayBuffer(8));
		expect(get(gameState).gameHistory).toContain('intro text');
	});

	it('resets state and re-throws on engine load error', async () => {
		vi.mocked(createGameEngine).mockImplementationOnce(() => ({
			onOutput: vi.fn(),
			loadGame: vi.fn().mockRejectedValue(new Error('bad rom')),
			sendCommand: vi.fn(),
			saveSnapshot: vi.fn(),
			restoreFromSnapshot: vi.fn(),
			destroy: vi.fn()
		}));

		await expect(loadGame('bad.z5', new ArrayBuffer(4))).rejects.toThrow('bad rom');
		expect(get(isGameLoaded)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// sendCommand
// ---------------------------------------------------------------------------

describe('sendCommand', () => {
	it('throws when no game is loaded', () => {
		expect(() => sendCommand('north')).toThrow('No game loaded');
	});

	it('adds the command to commandHistory', async () => {
		await loadGame('zork.z5', new ArrayBuffer(8));
		sendCommand('north');
		expect(get(gameState).commandHistory).toContain('north');
	});

	it('calls engine.sendCommand with the given command', async () => {
		await loadGame('zork.z5', new ArrayBuffer(8));
		const engine = get(gameState).engine!;
		sendCommand('look');
		expect(engine.sendCommand).toHaveBeenCalledWith('look');
	});
});

// ---------------------------------------------------------------------------
// restartGame
// ---------------------------------------------------------------------------

describe('restartGame', () => {
	it('clears game history on restart', async () => {
		await loadGame('zork.z5', new ArrayBuffer(8));
		addOutput('some output');
		await restartGame();
		expect(get(gameState).gameHistory).toEqual([]);
	});

	it('destroys the old engine before creating a new one', async () => {
		await loadGame('zork.z5', new ArrayBuffer(8));
		const oldEngine = get(gameState).engine!;
		await restartGame();
		expect(oldEngine.destroy).toHaveBeenCalled();
	});

	it('marks game as loaded after restart', async () => {
		await loadGame('zork.z5', new ArrayBuffer(8));
		await restartGame();
		expect(get(isGameLoaded)).toBe(true);
	});

	it('is a no-op when no game is loaded', async () => {
		await expect(restartGame()).resolves.toBeUndefined();
	});

	it('captures output emitted by the new engine during restart', async () => {
		await loadGame('zork.z5', new ArrayBuffer(8));
		// The next createGameEngine() call (inside restartGame) fires output synchronously
		vi.mocked(createGameEngine).mockImplementationOnce(() => ({
			onOutput: (cb: (text: string) => void) => { cb('restarted!'); },
			loadGame: vi.fn().mockResolvedValue(undefined),
			sendCommand: vi.fn(),
			saveSnapshot: vi.fn().mockReturnValue({}),
			restoreFromSnapshot: vi.fn().mockResolvedValue(undefined),
			destroy: vi.fn()
		}));
		await restartGame();
		expect(get(gameState).gameHistory).toContain('restarted!');
	});
});

// ---------------------------------------------------------------------------
// saveGame
// ---------------------------------------------------------------------------

describe('saveGame', () => {
	it('throws when no game is loaded', async () => {
		await expect(saveGame('slot')).rejects.toThrow('Nenhum jogo carregado');
	});

	it('throws when the engine snapshot fails', async () => {
		vi.mocked(createGameEngine).mockImplementationOnce(() => ({
			onOutput: vi.fn(),
			loadGame: vi.fn().mockResolvedValue(undefined),
			sendCommand: vi.fn(),
			saveSnapshot: vi.fn().mockReturnValue(null),
			restoreFromSnapshot: vi.fn(),
			destroy: vi.fn()
		}));
		await loadGame('zork.z5', new ArrayBuffer(8));
		await expect(saveGame('slot')).rejects.toThrow('Falha ao criar snapshot');
	});

	it('writes the save slot to persistence', async () => {
		await loadGame('zork.z5', new ArrayBuffer(8));
		await saveGame('quicksave');
		expect(writeSaveSlot).toHaveBeenCalledOnce();
	});

	it('includes the AI memory in the slot when provided', async () => {
		await loadGame('zork.z5', new ArrayBuffer(8));
		const aiMemory = ['Estou na floresta', 'Tenho uma lanterna'];
		await saveGame('slot', aiMemory);
		const slot = vi.mocked(writeSaveSlot).mock.calls[0][1];
		expect(slot.aiMemory).toEqual(aiMemory);
	});
});

// ---------------------------------------------------------------------------
// loadFromSaveSlot
// ---------------------------------------------------------------------------

describe('loadFromSaveSlot', () => {
	const makeSlot = (): SaveSlot => ({
		slotName: 'test-slot',
		gameName: 'zork',
		timestamp: '2026-01-01T00:00:00.000Z',
		snapshot: { data: 'snap' },
		gameHistory: ['> north', 'Forest Path'],
		gameData: new ArrayBuffer(8)
	});

	it('marks the game as loaded', async () => {
		await loadFromSaveSlot(makeSlot());
		expect(get(isGameLoaded)).toBe(true);
	});

	it('restores the game name from the slot', async () => {
		await loadFromSaveSlot(makeSlot());
		expect(get(currentGameName)).toBe('zork');
	});

	it('prepends the saved history with a restore notice', async () => {
		await loadFromSaveSlot(makeSlot());
		const history = get(gameState).gameHistory;
		expect(history).toContain('> north');
		expect(history.some((l) => l.includes('Jogo restaurado'))).toBe(true);
	});

	it('captures output emitted during restore', async () => {
		// The onOutput callback is registered before restoreFromSnapshot, but the
		// store is only populated with slot.gameHistory AFTER registration.
		// So the callback must fire during restoreFromSnapshot to be appended correctly.
		let outputCallback: ((text: string) => void) | null = null;
		vi.mocked(createGameEngine).mockImplementationOnce(() => ({
			onOutput: (cb: (text: string) => void) => { outputCallback = cb; },
			loadGame: vi.fn().mockResolvedValue(undefined),
			sendCommand: vi.fn(),
			saveSnapshot: vi.fn().mockReturnValue({}),
			restoreFromSnapshot: vi.fn().mockImplementation(async () => {
				outputCallback?.('restore output');
			}),
			destroy: vi.fn()
		}));
		await loadFromSaveSlot(makeSlot());
		expect(get(gameState).gameHistory).toContain('restore output');
	});

	it('destroys the existing engine before restoring', async () => {
		await loadGame('zork.z5', new ArrayBuffer(8));
		const oldEngine = get(gameState).engine!;
		await loadFromSaveSlot(makeSlot());
		expect(oldEngine.destroy).toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// unloadGame
// ---------------------------------------------------------------------------

describe('unloadGame', () => {
	it('resets to initial state', async () => {
		await loadGame('zork.z5', new ArrayBuffer(8));
		unloadGame();
		expect(get(isGameLoaded)).toBe(false);
		expect(get(currentGameName)).toBe('');
	});

	it('destroys the engine if one is loaded', async () => {
		await loadGame('zork.z5', new ArrayBuffer(8));
		const engine = get(gameState).engine!;
		unloadGame();
		expect(engine.destroy).toHaveBeenCalled();
	});

	it('is safe to call when no game is loaded', () => {
		expect(() => unloadGame()).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// getSaveSlotList
// ---------------------------------------------------------------------------

describe('getSaveSlotList', () => {
	it('returns empty object when no game is loaded', async () => {
		expect(await getSaveSlotList()).toEqual({});
	});

	it('delegates to persistence with the current game name', async () => {
		await loadGame('zork.z5', new ArrayBuffer(8));
		await getSaveSlotList();
		expect(getSaveSlots).toHaveBeenCalledWith('zork');
	});
});

// ---------------------------------------------------------------------------
// removeSaveSlot
// ---------------------------------------------------------------------------

describe('removeSaveSlot', () => {
	it('is a no-op when no game is loaded', async () => {
		await expect(removeSaveSlot('any')).resolves.toBeUndefined();
		expect(deleteSaveSlot).not.toHaveBeenCalled();
	});

	it('delegates to persistence with the current game name and slot name', async () => {
		await loadGame('zork.z5', new ArrayBuffer(8));
		await removeSaveSlot('quicksave');
		expect(deleteSaveSlot).toHaveBeenCalledWith('zork', 'quicksave');
	});
});
