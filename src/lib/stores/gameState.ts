/**
 * Game State Store
 *
 * Manages the global state of the loaded game, including
 * game history, command history, and the game engine instance.
 */

import { writable, derived, get } from 'svelte/store';
import { createGameEngine, type GameEngine } from '$lib/zmachine';
import {
	getSaveSlots,
	writeSaveSlot,
	deleteSaveSlot,
	type SaveSlot,
	type GameSaveSlots
} from '$lib/stores/aiPersistence';

export interface GameState {
	isLoaded: boolean;
	gameName: string;
	gameHistory: string[];
	commandHistory: string[];
	engine: GameEngine | null;
	/** Original game file — needed to restore from a save slot */
	gameData: ArrayBuffer | null;
}

export type { SaveSlot, GameSaveSlots };

// Initial state
const initialState: GameState = {
	isLoaded: false,
	gameName: '',
	gameHistory: [],
	commandHistory: [],
	engine: null,
	gameData: null
};

// Create the writable store
const gameStateStore = writable<GameState>(initialState);

/**
 * Load a game from ArrayBuffer
 */
export async function loadGame(filename: string, gameData: ArrayBuffer): Promise<void> {
	try {
		// Create new game engine
		const engine = createGameEngine();

		// Update state to loading
		gameStateStore.update(state => ({
			...state,
			gameName: filename.replace(/\.[^.]+$/, ''), // Remove extension
			isLoaded: false,
			engine: null
		}));

		// Register output callback BEFORE loading — the VM produces
		// initial output (game intro text) during loadGame() → vm.init()
		engine.onOutput((text: string) => {
			gameStateStore.update(state => ({
				...state,
				gameHistory: [...state.gameHistory, text]
			}));
		});

		// Load the game (VM runs synchronously until first input request)
		await engine.loadGame(gameData);

		// Update state to loaded (keep gameData for future save/restore)
		gameStateStore.update(state => ({
			...state,
			isLoaded: true,
			engine,
			gameData
		}));
	} catch (error) {
		console.error('Failed to load game:', error);
		gameStateStore.update(state => ({
			...state,
			isLoaded: false,
			engine: null
		}));
		throw error;
	}
}

/**
 * Send a command to the game
 */
export function sendCommand(command: string): void {
	const state = get(gameStateStore);

	if (!state.isLoaded || !state.engine) {
		throw new Error('No game loaded');
	}

	// Add to command history
	gameStateStore.update(s => ({
		...s,
		commandHistory: [...s.commandHistory, command]
	}));

	// Send to engine
	state.engine.sendCommand(command);
}

/**
 * Add a line to game history (e.g. player command echo)
 */
export function addOutput(text: string): void {
	gameStateStore.update(state => ({
		...state,
		gameHistory: [...state.gameHistory, text]
	}));
}

/**
 * Clear game history (output)
 */
export function clearHistory(): void {
	gameStateStore.update(state => ({
		...state,
		gameHistory: []
	}));
}

/**
 * Restart the current game.
 *
 * Recarrega o jogo do gameData armazenado em vez de usar vm.restart(),
 * pois vm.restart() não passa pelo mesmo ciclo de execução de vm.init()
 * e o output inicial fica retido no buffer sem ser entregue ao callback.
 */
export async function restartGame(): Promise<void> {
	const state = get(gameStateStore);

	if (!state.engine || !state.gameData) return;

	// Destrói a engine atual
	state.engine.destroy();

	const engine = createGameEngine();
	const { gameName, gameData } = state;

	// Limpa o histórico e marca como não carregado antes de iniciar
	gameStateStore.update(s => ({
		...s,
		isLoaded: false,
		gameHistory: [],
		commandHistory: [],
		engine: null
	}));

	// Registra callback ANTES de loadGame — o VM produz output durante init()
	engine.onOutput((text: string) => {
		gameStateStore.update(s => ({
			...s,
			gameHistory: [...s.gameHistory, text]
		}));
	});

	await engine.loadGame(gameData);

	gameStateStore.update(s => ({
		...s,
		isLoaded: true,
		engine,
		gameName,
		gameData
	}));
}

/**
 * Save the current game state to a named slot in IndexedDB.
 * Takes a full VM snapshot via GameEngine.saveSnapshot() and persists it
 * alongside the current game output, the original game file, and the AI status.
 *
 * @param slotName - Name for the save slot
 * @param aiGameStatus - Current AI game status (location, inventory, map, etc.)
 */
export async function saveGame(slotName: string, aiGameStatus?: import('./aiPersistence').GameStatus): Promise<void> {
	const state = get(gameStateStore);

	if (!state.isLoaded || !state.engine || !state.gameData) {
		throw new Error('Nenhum jogo carregado');
	}

	const snapshot = state.engine.saveSnapshot();
	if (!snapshot) {
		throw new Error('Falha ao criar snapshot do jogo');
	}

	const slot: SaveSlot = {
		slotName,
		gameName: state.gameName,
		timestamp: new Date().toISOString(),
		snapshot,
		gameHistory: [...state.gameHistory],
		gameData: state.gameData,
		aiGameStatus
	};

	await writeSaveSlot(state.gameName, slot);
}

/**
 * Restore the game from a save slot.
 * Creates a fresh VM using the slot's stored game file, restores the
 * snapshot, and replaces the current game history with the saved one.
 */
export async function loadFromSaveSlot(slot: SaveSlot): Promise<void> {
	const state = get(gameStateStore);

	// Destroy existing engine if any
	if (state.engine) {
		state.engine.destroy();
	}

	const engine = createGameEngine();
	const gameName = slot.gameName;

	// Register output callback before restore so intro/restore output is captured
	engine.onOutput((text: string) => {
		gameStateStore.update(s => ({
			...s,
			gameHistory: [...s.gameHistory, text]
		}));
	});

	// Restore game history first (so the callback appends after it)
	gameStateStore.update(s => ({
		...s,
		isLoaded: false,
		gameName,
		gameHistory: [...slot.gameHistory, `\n[Jogo restaurado: "${slot.slotName}"]\n`],
		commandHistory: [],
		engine: null,
		gameData: slot.gameData
	}));

	// Restore the VM from the snapshot
	await engine.restoreFromSnapshot(slot.gameData, slot.snapshot);

	gameStateStore.update(s => ({
		...s,
		isLoaded: true,
		engine
	}));
}

/**
 * Return all save slots for the currently loaded game.
 */
export async function getSaveSlotList(): Promise<GameSaveSlots> {
	const state = get(gameStateStore);
	if (!state.gameName) return {};
	return getSaveSlots(state.gameName);
}

/**
 * Delete a save slot for the currently loaded game.
 */
export async function removeSaveSlot(slotName: string): Promise<void> {
	const state = get(gameStateStore);
	if (!state.gameName) return;
	await deleteSaveSlot(state.gameName, slotName);
}

/**
 * Unload the current game and reset state
 */
export function unloadGame(): void {
	const state = get(gameStateStore);

	if (state.engine) {
		state.engine.destroy();
	}

	gameStateStore.set(initialState);
}

/**
 * Derived store: Is a game currently loaded?
 */
export const isGameLoaded = derived(
	gameStateStore,
	$state => $state.isLoaded
);

/**
 * Derived store: Current game name
 */
export const currentGameName = derived(
	gameStateStore,
	$state => $state.gameName
);

/**
 * Derived store: Game engine instance
 */
export const gameEngine = derived(
	gameStateStore,
	$state => $state.engine
);

/**
 * Export the main store
 */
export const gameState = {
	subscribe: gameStateStore.subscribe,
	loadGame,
	sendCommand,
	addOutput,
	clearHistory,
	restartGame,
	unloadGame,
	saveGame,
	loadFromSaveSlot,
	getSaveSlotList,
	removeSaveSlot
};
