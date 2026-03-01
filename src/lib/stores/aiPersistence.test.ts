// Polyfill IndexedDB for Node.js test environment
import 'fake-indexeddb/auto';

import { describe, it, expect } from 'vitest';
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
	type AIMemory,
	type AIChatMessage,
	type SaveSlot
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
