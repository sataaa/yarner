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

/** An entry in the game library — a previously loaded game stored for quick access */
export interface GameLibraryEntry {
	sha256: string;
	filename: string;
	gameName: string;
	fileSize: number;
	addedDate: string;
	lastPlayed: string;
	gameData: ArrayBuffer;
}

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
	/** Game library: previously loaded games stored for quick reload */
	gameLibrary: {
		key: string;
		value: GameLibraryEntry;
	};
}

const DB_NAME = 'yarner-ai';
// Version 3: added gameLibrary object store
const DB_VERSION = 3;

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
			if (oldVersion < 3) {
				db.createObjectStore('gameLibrary');
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

// ---- Game Library ----

/** Compute SHA-256 hash of an ArrayBuffer, returned as hex string */
export async function computeSHA256(data: ArrayBuffer): Promise<string> {
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Add or update a game in the library (upsert by SHA-256) */
export async function addGameToLibrary(entry: GameLibraryEntry): Promise<void> {
	const db = await getDB();
	await db.put('gameLibrary', entry, entry.sha256);
}

/** Get all games in the library, sorted by lastPlayed descending */
export async function getGameLibrary(): Promise<GameLibraryEntry[]> {
	const db = await getDB();
	const all = await db.getAll('gameLibrary');
	return all.sort((a, b) => b.lastPlayed.localeCompare(a.lastPlayed));
}

/** Get a single game from the library by SHA-256 */
export async function getGameFromLibrary(sha256: string): Promise<GameLibraryEntry | undefined> {
	const db = await getDB();
	return db.get('gameLibrary', sha256);
}

/** Remove a game from the library and all its associated data (saves, AI memory, chat) */
export async function removeGameFromLibrary(sha256: string): Promise<void> {
	const db = await getDB();
	const entry = await db.get('gameLibrary', sha256);
	if (entry) {
		await db.delete('gameSaves', entry.gameName);
		await db.delete('gameStatus', entry.gameName);
		await db.delete('chatHistory', entry.gameName);
	}
	await db.delete('gameLibrary', sha256);
}

/** Update the lastPlayed timestamp for a game in the library */
export async function updateLastPlayed(sha256: string): Promise<void> {
	const db = await getDB();
	const entry = await db.get('gameLibrary', sha256);
	if (entry) {
		entry.lastPlayed = new Date().toISOString();
		await db.put('gameLibrary', entry, sha256);
	}
}

// ---- Helpers ----

/** All localStorage keys used by Yarner */
const YARNER_LOCALSTORAGE_KEYS = [
	'yarner-api-key',
	'yarner-provider-id',
	'yarner-api-url',
	'yarner-model',
	'yarner-locale',
	'yarner-theme'
];

/** Clear ALL Yarner data: all 4 IndexedDB stores + all localStorage keys */
export async function clearAllData(): Promise<void> {
	const db = await getDB();
	const tx = db.transaction(
		['gameStatus', 'chatHistory', 'gameSaves', 'gameLibrary'],
		'readwrite'
	);
	await Promise.all([
		tx.objectStore('gameStatus').clear(),
		tx.objectStore('chatHistory').clear(),
		tx.objectStore('gameSaves').clear(),
		tx.objectStore('gameLibrary').clear(),
		tx.done
	]);
	for (const key of YARNER_LOCALSTORAGE_KEYS) {
		localStorage.removeItem(key);
	}
}

/** Create an empty AI memory */
export function createEmptyMemory(): AIMemory {
	return [];
}
