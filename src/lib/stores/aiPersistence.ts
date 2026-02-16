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
	/** ISO timestamp of when this status was last updated */
	ultimaAtualizacao: string;
}

/** A single message in the AI chat conversation */
export interface AIChatMessage {
	role: 'user' | 'assistant';
	content: string;
	timestamp: number;
}

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
}

const DB_NAME = 'yarner-ai';
const DB_VERSION = 1;

/** Open (or create) the IndexedDB database */
async function getDB(): Promise<IDBPDatabase<YarnerAIDB>> {
	return openDB<YarnerAIDB>(DB_NAME, DB_VERSION, {
		upgrade(db) {
			if (!db.objectStoreNames.contains('gameStatus')) {
				db.createObjectStore('gameStatus');
			}
			if (!db.objectStoreNames.contains('chatHistory')) {
				db.createObjectStore('chatHistory');
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
		ultimaAtualizacao: new Date().toISOString()
	};
}
