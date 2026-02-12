/**
 * Game State Store
 *
 * Manages the global state of the loaded game, including
 * game history, command history, and the game engine instance.
 */

import { writable, derived, get } from 'svelte/store';
import { createGameEngine, type GameEngine } from '$lib/zmachine/zvm-wrapper';

export interface GameState {
	isLoaded: boolean;
	gameName: string;
	gameHistory: string[];
	commandHistory: string[];
	engine: GameEngine | null;
}

// Initial state
const initialState: GameState = {
	isLoaded: false,
	gameName: '',
	gameHistory: [],
	commandHistory: [],
	engine: null
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

		// Load the game
		await engine.loadGame(gameData);

		// Register output callback to capture game history
		engine.onOutput((text: string) => {
			gameStateStore.update(state => ({
				...state,
				gameHistory: [...state.gameHistory, text]
			}));
		});

		// Update state to loaded
		gameStateStore.update(state => ({
			...state,
			isLoaded: true,
			engine
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
 * Clear game history (output)
 */
export function clearHistory(): void {
	gameStateStore.update(state => ({
		...state,
		gameHistory: []
	}));
}

/**
 * Restart the current game
 */
export function restartGame(): void {
	const state = get(gameStateStore);

	if (state.engine) {
		state.engine.restart();

		gameStateStore.update(s => ({
			...s,
			gameHistory: [],
			commandHistory: []
		}));
	}
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
	clearHistory,
	restartGame,
	unloadGame
};
