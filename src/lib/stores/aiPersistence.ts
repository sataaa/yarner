/**
 * AI Persistence Layer — IndexedDB storage for AI assistant state
 *
 * Stores AI memory notes and chat history per game using the `idb` library.
 * Each game has its own separate data, keyed by gameName.
 *
 * The API key is stored in localStorage (simpler for a "bring your own key" model).
 */

import { openDB, type IDBPDatabase } from 'idb';

// ---- Types ----

/** AI memory — a simple list of notes managed by the AI */
export type AIMemory = string[];

/** A single message in the AI chat conversation */
export interface AIChatMessage {
	role: 'user' | 'assistant';
	content: string;
	timestamp: number;
}

/**
 * A manual save slot created by the player.
 * Stores the full VM snapshot (from do_autosave) plus the visible game history
 * and the original game file so the game can be restored in future sessions.
 */
export interface SaveSlot {
	slotName: string;
	gameName: string;
	timestamp: string;
	/** VM snapshot from GameEngine.saveSnapshot() */
	snapshot: any;
	/** Game output lines at the time of saving (shown on restore) */
	gameHistory: string[];
	/** Original game file — needed to recreate the static ROM on restore */
	gameData: ArrayBuffer;
	/** AI memory notes at the time of saving */
	aiMemory?: AIMemory;
	/** AI chat messages at the time of saving */
	aiChatMessages?: AIChatMessage[];
}

/** All save slots for one game, keyed by slotName */
export type GameSaveSlots = Record<string, SaveSlot>;

// ---- IndexedDB Schema ----

interface YarnerAIDB {
	gameStatus: {
		key: string;
		value: AIMemory;
	};
	chatHistory: {
		key: string;
		value: AIChatMessage[];
	};
	/** Save slots keyed by gameName; each value is a map of slotName → SaveSlot */
	gameSaves: {
		key: string;
		value: GameSaveSlots;
	};
}

const DB_NAME = 'yarner-ai';
// Version 2: added gameSaves object store
const DB_VERSION = 2;

/** Open (or create) the IndexedDB database */
async function getDB(): Promise<IDBPDatabase<YarnerAIDB>> {
	return openDB<YarnerAIDB>(DB_NAME, DB_VERSION, {
		upgrade(db, oldVersion) {
			if (oldVersion < 1) {
				db.createObjectStore('gameStatus');
				db.createObjectStore('chatHistory');
			}
			if (oldVersion < 2) {
				db.createObjectStore('gameSaves');
			}
		}
	});
}

// ---- AI Memory ----

export async function saveAIMemory(gameName: string, memory: AIMemory): Promise<void> {
	const db = await getDB();
	await db.put('gameStatus', memory, gameName);
}

export async function loadAIMemory(gameName: string): Promise<AIMemory | undefined> {
	const db = await getDB();
	return db.get('gameStatus', gameName);
}

// ---- Chat History ----

export async function saveChatHistory(gameName: string, messages: AIChatMessage[]): Promise<void> {
	const db = await getDB();
	await db.put('chatHistory', messages, gameName);
}

export async function loadChatHistory(gameName: string): Promise<AIChatMessage[]> {
	const db = await getDB();
	return (await db.get('chatHistory', gameName)) || [];
}

// ---- Save Slots ----

/** Return all save slots for a game (empty object if none exist) */
export async function getSaveSlots(gameName: string): Promise<GameSaveSlots> {
	const db = await getDB();
	return (await db.get('gameSaves', gameName)) ?? {};
}

/** Create or overwrite a single save slot */
export async function writeSaveSlot(gameName: string, slot: SaveSlot): Promise<void> {
	const db = await getDB();
	const existing = (await db.get('gameSaves', gameName)) ?? {};
	existing[slot.slotName] = slot;
	await db.put('gameSaves', existing, gameName);
}

/** Delete a single save slot; removes the game entry if no slots remain */
export async function deleteSaveSlot(gameName: string, slotName: string): Promise<void> {
	const db = await getDB();
	const existing = (await db.get('gameSaves', gameName)) ?? {};
	delete existing[slotName];
	if (Object.keys(existing).length === 0) {
		await db.delete('gameSaves', gameName);
	} else {
		await db.put('gameSaves', existing, gameName);
	}
}

// ---- Cleanup ----

/** Clear all AI data for a specific game */
export async function clearGameAIData(gameName: string): Promise<void> {
	const db = await getDB();
	await db.delete('gameStatus', gameName);
	await db.delete('chatHistory', gameName);
}

// ---- Helpers ----

/** Create an empty AI memory */
export function createEmptyMemory(): AIMemory {
	return [];
}
