// Polyfill IndexedDB for Node.js test environment
import 'fake-indexeddb/auto';

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
	createEmptyMemory,
	saveAIMemory,
	loadAIMemory,
	saveChatHistory,
	loadChatHistory,
	getSaveSlots,
	writeSaveSlot,
	deleteSaveSlot,
	clearGameAIData,
	clearAllData,
	computeSHA256,
	addGameToLibrary,
	getGameLibrary,
	getGameFromLibrary,
	removeGameFromLibrary,
	updateLastPlayed,
	type AIMemory,
	type AIChatMessage,
	type SaveSlot,
	type GameLibraryEntry
} from './aiPersistence';

// Each describe block uses a unique game name to avoid data collisions between
// tests that share the same in-memory fake IndexedDB instance.

const makeMemory = (...notes: string[]): AIMemory => notes;

const makeSlot = (slotName: string, gameName: string): SaveSlot => ({
	slotName,
	gameName,
	timestamp: '2026-01-01T00:00:00.000Z',
	snapshot: { data: 'snapshot-bytes' },
	gameHistory: ['line 1', 'line 2'],
	gameData: new ArrayBuffer(8)
});

// ---------------------------------------------------------------------------
// createEmptyMemory
// ---------------------------------------------------------------------------

describe('createEmptyMemory', () => {
	it('returns an empty array', () => {
		const memory = createEmptyMemory();
		expect(memory).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// saveAIMemory / loadAIMemory
// ---------------------------------------------------------------------------

describe('saveAIMemory / loadAIMemory', () => {
	it('round-trips AI memory', async () => {
		const memory = makeMemory('Estou na floresta', 'Tenho uma lanterna');
		await saveAIMemory('persist-game-1', memory);
		const loaded = await loadAIMemory('persist-game-1');
		expect(loaded).toEqual(memory);
	});

	it('returns undefined for a game that was never saved', async () => {
		const result = await loadAIMemory('nonexistent-game-xyz-1');
		expect(result).toBeUndefined();
	});

	it('overwrites previous memory for the same game', async () => {
		await saveAIMemory('persist-game-2', makeMemory('nota antiga'));
		await saveAIMemory('persist-game-2', makeMemory('nota nova'));
		const loaded = await loadAIMemory('persist-game-2');
		expect(loaded).toEqual(['nota nova']);
	});
});

// ---------------------------------------------------------------------------
// saveChatHistory / loadChatHistory
// ---------------------------------------------------------------------------

describe('saveChatHistory / loadChatHistory', () => {
	it('round-trips chat messages', async () => {
		const messages: AIChatMessage[] = [
			{ role: 'user', content: 'Onde estou?', timestamp: 1000 },
			{ role: 'assistant', content: 'Você está em West of House.', timestamp: 1001 }
		];
		await saveChatHistory('chat-game-1', messages);
		const loaded = await loadChatHistory('chat-game-1');
		expect(loaded).toEqual(messages);
	});

	it('returns an empty array for a game with no saved chat', async () => {
		const result = await loadChatHistory('nonexistent-chat-xyz-1');
		expect(result).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// writeSaveSlot / getSaveSlots
// ---------------------------------------------------------------------------

describe('writeSaveSlot / getSaveSlots', () => {
	it('returns an empty object when no slots exist', async () => {
		const slots = await getSaveSlots('slots-game-no-data');
		expect(slots).toEqual({});
	});

	it('writes and retrieves a save slot', async () => {
		const slot = makeSlot('quicksave', 'slots-game-1');
		await writeSaveSlot('slots-game-1', slot);
		const slots = await getSaveSlots('slots-game-1');
		expect(slots['quicksave']).toBeDefined();
		expect(slots['quicksave'].gameName).toBe('slots-game-1');
		expect(slots['quicksave'].gameHistory).toEqual(['line 1', 'line 2']);
	});

	it('preserves existing slots when writing a new one', async () => {
		await writeSaveSlot('slots-game-2', makeSlot('slot-a', 'slots-game-2'));
		await writeSaveSlot('slots-game-2', makeSlot('slot-b', 'slots-game-2'));
		const slots = await getSaveSlots('slots-game-2');
		expect(Object.keys(slots)).toHaveLength(2);
		expect(slots['slot-a']).toBeDefined();
		expect(slots['slot-b']).toBeDefined();
	});

	it('overwrites a slot with the same name', async () => {
		await writeSaveSlot('slots-game-3', makeSlot('overwrite-me', 'slots-game-3'));
		const updated = { ...makeSlot('overwrite-me', 'slots-game-3'), gameHistory: ['updated'] };
		await writeSaveSlot('slots-game-3', updated);
		const slots = await getSaveSlots('slots-game-3');
		expect(slots['overwrite-me'].gameHistory).toEqual(['updated']);
	});

	it('stores aiMemory in save slot', async () => {
		const slot: SaveSlot = { ...makeSlot('with-memory', 'slots-game-4'), aiMemory: ['nota1', 'nota2'] };
		await writeSaveSlot('slots-game-4', slot);
		const slots = await getSaveSlots('slots-game-4');
		expect(slots['with-memory'].aiMemory).toEqual(['nota1', 'nota2']);
	});
});

// ---------------------------------------------------------------------------
// deleteSaveSlot
// ---------------------------------------------------------------------------

describe('deleteSaveSlot', () => {
	it('is a no-op for a slot that does not exist (covers ?? {} fallback)', async () => {
		await expect(deleteSaveSlot('game-never-saved', 'ghost-slot')).resolves.toBeUndefined();
		const slots = await getSaveSlots('game-never-saved');
		expect(Object.keys(slots)).toHaveLength(0);
	});

	it('removes the specified slot', async () => {
		await writeSaveSlot('delete-game-1', makeSlot('to-delete', 'delete-game-1'));
		await writeSaveSlot('delete-game-1', makeSlot('keep-me', 'delete-game-1'));
		await deleteSaveSlot('delete-game-1', 'to-delete');
		const slots = await getSaveSlots('delete-game-1');
		expect(slots['to-delete']).toBeUndefined();
		expect(slots['keep-me']).toBeDefined();
	});

	it('removes the game entry entirely when the last slot is deleted', async () => {
		await writeSaveSlot('delete-game-2', makeSlot('only-slot', 'delete-game-2'));
		await deleteSaveSlot('delete-game-2', 'only-slot');
		const slots = await getSaveSlots('delete-game-2');
		expect(Object.keys(slots)).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// clearGameAIData
// ---------------------------------------------------------------------------

describe('clearGameAIData', () => {
	it('removes AI memory and chat history for a game', async () => {
		await saveAIMemory('clear-game-1', makeMemory('nota'));
		await saveChatHistory('clear-game-1', [{ role: 'user', content: 'hi', timestamp: 1 }]);
		await clearGameAIData('clear-game-1');
		expect(await loadAIMemory('clear-game-1')).toBeUndefined();
		expect(await loadChatHistory('clear-game-1')).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// computeSHA256
// ---------------------------------------------------------------------------

const makeLibraryEntry = (sha256: string, gameName: string, lastPlayed?: string): GameLibraryEntry => ({
	sha256,
	filename: `${gameName}.z5`,
	gameName,
	fileSize: 128,
	addedDate: '2026-01-01T00:00:00.000Z',
	lastPlayed: lastPlayed ?? '2026-01-01T00:00:00.000Z',
	gameData: new ArrayBuffer(128)
});

describe('computeSHA256', () => {
	it('returns consistent hash for the same input', async () => {
		const data = new Uint8Array([1, 2, 3, 4]).buffer;
		const hash1 = await computeSHA256(data);
		const hash2 = await computeSHA256(data);
		expect(hash1).toBe(hash2);
		expect(hash1).toHaveLength(64); // SHA-256 = 64 hex chars
	});

	it('returns different hashes for different inputs', async () => {
		const a = new Uint8Array([1, 2, 3]).buffer;
		const b = new Uint8Array([4, 5, 6]).buffer;
		expect(await computeSHA256(a)).not.toBe(await computeSHA256(b));
	});
});

// ---------------------------------------------------------------------------
// Game Library CRUD
// ---------------------------------------------------------------------------

describe('addGameToLibrary / getGameLibrary', () => {
	it('round-trips a library entry', async () => {
		const entry = makeLibraryEntry('sha-lib-1', 'zork');
		await addGameToLibrary(entry);
		const lib = await getGameLibrary();
		const found = lib.find(e => e.sha256 === 'sha-lib-1');
		expect(found).toBeDefined();
		expect(found!.gameName).toBe('zork');
	});

	it('upserts on same SHA (deduplication)', async () => {
		const entry1 = makeLibraryEntry('sha-lib-dedup', 'zork');
		const entry2 = { ...makeLibraryEntry('sha-lib-dedup', 'zork'), lastPlayed: '2026-06-01T00:00:00.000Z' };
		await addGameToLibrary(entry1);
		await addGameToLibrary(entry2);
		const lib = await getGameLibrary();
		const matches = lib.filter(e => e.sha256 === 'sha-lib-dedup');
		expect(matches).toHaveLength(1);
		expect(matches[0].lastPlayed).toBe('2026-06-01T00:00:00.000Z');
	});

	it('returns entries sorted by lastPlayed descending', async () => {
		await addGameToLibrary(makeLibraryEntry('sha-lib-old', 'old-game', '2025-01-01T00:00:00.000Z'));
		await addGameToLibrary(makeLibraryEntry('sha-lib-new', 'new-game', '2026-12-01T00:00:00.000Z'));
		const lib = await getGameLibrary();
		const oldIdx = lib.findIndex(e => e.sha256 === 'sha-lib-old');
		const newIdx = lib.findIndex(e => e.sha256 === 'sha-lib-new');
		expect(newIdx).toBeLessThan(oldIdx);
	});
});

describe('getGameFromLibrary', () => {
	it('returns entry by SHA-256', async () => {
		await addGameToLibrary(makeLibraryEntry('sha-lib-get', 'hitchhiker'));
		const entry = await getGameFromLibrary('sha-lib-get');
		expect(entry).toBeDefined();
		expect(entry!.gameName).toBe('hitchhiker');
	});

	it('returns undefined for nonexistent SHA', async () => {
		const entry = await getGameFromLibrary('nonexistent-sha-xyz');
		expect(entry).toBeUndefined();
	});
});

describe('removeGameFromLibrary', () => {
	it('removes entry by SHA-256', async () => {
		await addGameToLibrary(makeLibraryEntry('sha-lib-remove', 'planetfall'));
		await removeGameFromLibrary('sha-lib-remove');
		const entry = await getGameFromLibrary('sha-lib-remove');
		expect(entry).toBeUndefined();
	});

	it('cannot remove a bundled game', async () => {
		const entry: GameLibraryEntry = { ...makeLibraryEntry('bundled-sha', 'advent'), bundled: true };
		await addGameToLibrary(entry);
		await removeGameFromLibrary('bundled-sha');
		const result = await getGameFromLibrary('bundled-sha');
		expect(result).toBeDefined(); // still there
	});

	it('also removes saves, AI memory and chat history for that game', async () => {
		const gameName = 'cascade-game';
		await addGameToLibrary(makeLibraryEntry('sha-lib-cascade', gameName));
		await saveAIMemory(gameName, makeMemory('nota'));
		await saveChatHistory(gameName, [{ role: 'user', content: 'hi', timestamp: 1 }]);
		await writeSaveSlot(gameName, makeSlot('slot1', gameName));

		await removeGameFromLibrary('sha-lib-cascade');

		expect(await getGameFromLibrary('sha-lib-cascade')).toBeUndefined();
		expect(await loadAIMemory(gameName)).toBeUndefined();
		expect(await loadChatHistory(gameName)).toEqual([]);
		expect(await getSaveSlots(gameName)).toEqual({});
	});
});

describe('updateLastPlayed', () => {
	it('updates the lastPlayed timestamp', async () => {
		await addGameToLibrary(makeLibraryEntry('sha-lib-update', 'enchanter', '2025-01-01T00:00:00.000Z'));
		await updateLastPlayed('sha-lib-update');
		const entry = await getGameFromLibrary('sha-lib-update');
		expect(entry).toBeDefined();
		// O lastPlayed agora deve ser mais recente
		expect(entry!.lastPlayed > '2025-01-01T00:00:00.000Z').toBe(true);
	});

	it('is a no-op for nonexistent SHA', async () => {
		await expect(updateLastPlayed('ghost-sha-xyz')).resolves.toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// clearAllData
// ---------------------------------------------------------------------------

describe('clearAllData', () => {
	// Mock localStorage for Node test environment
	const store: Record<string, string> = {};
	const mockLocalStorage = {
		getItem: (key: string) => store[key] ?? null,
		setItem: (key: string, value: string) => { store[key] = value; },
		removeItem: (key: string) => { delete store[key]; }
	};

	beforeAll(() => {
		(globalThis as any).localStorage = mockLocalStorage;
	});

	afterAll(() => {
		delete (globalThis as any).localStorage;
	});

	it('clears all IndexedDB stores and localStorage keys', async () => {
		// Seed all 4 stores
		await saveAIMemory('clear-all-test', makeMemory('note1'));
		await saveChatHistory('clear-all-test', [{ role: 'user', content: 'hi', timestamp: 1 }]);
		await writeSaveSlot('clear-all-test', makeSlot('slot1', 'clear-all-test'));
		await addGameToLibrary({
			sha256: 'sha-clear-all',
			filename: 'test.z5',
			gameName: 'clear-all-test',
			fileSize: 100,
			addedDate: '2026-01-01',
			lastPlayed: '2026-01-01',
			gameData: new ArrayBuffer(8)
		});

		// Seed localStorage
		localStorage.setItem('yarner-api-key', 'test-key');
		localStorage.setItem('yarner-theme', 'dark');
		localStorage.setItem('yarner-provider-id', 'gemini');

		await clearAllData();

		// Verify IDB is empty
		expect(await loadAIMemory('clear-all-test')).toBeUndefined();
		expect(await loadChatHistory('clear-all-test')).toEqual([]);
		expect(await getSaveSlots('clear-all-test')).toEqual({});
		expect(await getGameLibrary()).toEqual([]);

		// Verify localStorage is cleared
		expect(localStorage.getItem('yarner-api-key')).toBeNull();
		expect(localStorage.getItem('yarner-theme')).toBeNull();
		expect(localStorage.getItem('yarner-provider-id')).toBeNull();
	});
});
