/**
 * AI Persistence Layer — IndexedDB storage for AI assistant state
 *
 * Stores game status (inventory, objectives, etc.) and chat history
 * per game using the `idb` library. Each game has its own separate data,
 * keyed by gameName.
 *
 * The API key is stored in localStorage (simpler for a "bring your own key" model).
 */

import { openDB, type IDBPDatabase } from 'idb';

// ---- Types ----

/** State of a single visited location: exits and notes */
export interface LocalVisitado {
	/**
	 * Map of directions to destinations.
	 * Value is the destination location name if explored, or "não explorado" if not.
	 * Example: { "north": "Forest Path", "south": "não explorado" }
	 */
	saidas: Record<string, string>;
	/** Notes about this location's state (items on floor, locked doors, etc.) */
	notas: string[];
}

/** Structured game status maintained by the AI across interactions */
export interface GameStatus {
	/** Current player location in the game world */
	localizacaoAtual: string;
	/** Items the player is carrying */
	inventario: string[];
	/** Current objectives / goals (from game context and player conversations) */
	objetivos: string[];
	/** Things the AI noticed but the player hasn't explored yet */
	coisasNaoExploradas: string[];
	/** General observations and notes about the game state */
	observacoes: string[];
	/**
	 * Map of all visited locations with their exits and notes.
	 * Key: location name. Value: exits (direction → destination) and notes.
	 */
	locaisVisitados: Record<string, LocalVisitado>;
	/** ISO timestamp of when this status was last updated */
	ultimaAtualizacao: string;
}

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
	/** AI game status at the time of saving (location, inventory, map, etc.) */
	aiGameStatus?: GameStatus;
}

/** All save slots for one game, keyed by slotName */
export type GameSaveSlots = Record<string, SaveSlot>;

// ---- IndexedDB Schema ----

interface YarnerAIDB {
	gameStatus: {
		key: string;
		value: GameStatus;
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

// ---- Game Status ----

export async function saveGameStatus(gameName: string, status: GameStatus): Promise<void> {
	const db = await getDB();
	await db.put('gameStatus', status, gameName);
}

export async function loadGameStatus(gameName: string): Promise<GameStatus | undefined> {
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

/** Create an empty game status with default values */
export function createEmptyGameStatus(): GameStatus {
	return {
		localizacaoAtual: '',
		inventario: [],
		objetivos: [],
		coisasNaoExploradas: [],
		observacoes: [],
		locaisVisitados: {},
		ultimaAtualizacao: new Date().toISOString()
	};
}
