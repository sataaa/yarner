import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';

// Mock the z-machine engine — ifvms.js relies on browser APIs unavailable in Node
vi.mock('$lib/zmachine/zvm-wrapper', () => ({
	createGameEngine: vi.fn(() => ({
		onOutput: vi.fn(),
		loadGame: vi.fn().mockResolvedValue(undefined),
		sendCommand: vi.fn(),
		saveSnapshot: vi.fn().mockReturnValue({ data: 'mock-snapshot' }),
		restoreFromSnapshot: vi.fn().mockResolvedValue(undefined),
		destroy: vi.fn()
	}))
}));

// Mock the persistence layer — IndexedDB is not needed for these store tests
vi.mock('$lib/stores/aiPersistence', () => ({
	getSaveSlots: vi.fn().mockResolvedValue({}),
	writeSaveSlot: vi.fn().mockResolvedValue(undefined),
	deleteSaveSlot: vi.fn().mockResolvedValue(undefined)
}));

import {
	gameState,
	isGameLoaded,
	currentGameName,
	addOutput,
	clearHistory,
	sendCommand,
	unloadGame,
	getSaveSlotList,
	removeSaveSlot
} from './gameState';

// Reset store state before each test
beforeEach(() => {
	unloadGame();
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
// sendCommand
// ---------------------------------------------------------------------------

describe('sendCommand', () => {
	it('throws when no game is loaded', () => {
		expect(() => sendCommand('north')).toThrow('No game loaded');
	});
});

// ---------------------------------------------------------------------------
// getSaveSlotList
// ---------------------------------------------------------------------------

describe('getSaveSlotList', () => {
	it('returns an empty object when no game is loaded (gameName is empty)', async () => {
		const slots = await getSaveSlotList();
		expect(slots).toEqual({});
	});
});

// ---------------------------------------------------------------------------
// removeSaveSlot
// ---------------------------------------------------------------------------

describe('removeSaveSlot', () => {
	it('resolves without error when no game is loaded', async () => {
		await expect(removeSaveSlot('any-slot')).resolves.toBeUndefined();
	});
});
