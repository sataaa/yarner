/**
 * AI Chat Store — Central state management for the AI assistant
 *
 * Follows the same pattern as gameState.ts: a private writable store with
 * exported derived stores and action functions.
 *
 * Key responsibility: manages the "smart diff" mechanism that only sends
 * new game output to the AI, not the entire history every time.
 *
 * Data flow:
 * 1. User types a message
 * 2. Store computes diff of gameHistory since last AI interaction
 * 3. Sends diff + current game status + conversation to Claude API
 * 4. Parses response: updates chat messages and game status
 * 5. Persists to IndexedDB for cross-reload survival
 */

import { writable, derived, get } from 'svelte/store';
import { gameState } from './gameState';
import {
	saveGameStatus,
	loadGameStatus,
	saveChatHistory,
	loadChatHistory,
	createEmptyGameStatus,
	type GameStatus,
	type AIChatMessage
} from './aiPersistence';
import { sendToAIStreaming, getErrorMessage, PROVIDER_PRESETS } from '../api/claude';

// ---- State Interface ----

export interface AIChatState {
	messages: AIChatMessage[];
	gameStatus: GameStatus;
	/** Index into gameState.gameHistory[] — everything before this was already sent to AI */
	lastSentGameHistoryIndex: number;
	apiKey: string;
	/** Selected provider preset ID ('lmstudio', 'gemini', 'openai', 'custom') */
	providerId: string;
	/** API endpoint URL */
	apiUrl: string;
	/** Model name */
	model: string;
	isLoading: boolean;
	isStreaming: boolean;
	/** Accumulated text during streaming (for live display) */
	streamingContent: string;
	error: string;
}

const defaultPreset = PROVIDER_PRESETS[0]; // LM Studio

const initialState: AIChatState = {
	messages: [],
	gameStatus: createEmptyGameStatus(),
	lastSentGameHistoryIndex: 0,
	apiKey: '',
	providerId: defaultPreset.id,
	apiUrl: defaultPreset.apiUrl,
	model: defaultPreset.defaultModel,
	isLoading: false,
	isStreaming: false,
	streamingContent: '',
	error: ''
};

// ---- Store ----

const aiChatStore = writable<AIChatState>(initialState);

// AbortController for the current streaming request.
// Kept outside the store (not serializable) — module-level is fine since
// there is only ever one active stream at a time.
let currentAbortController: AbortController | null = null;

/** Cancel any in-progress AI streaming request. Safe to call when idle. */
export function abortStreaming(): void {
	if (currentAbortController) {
		currentAbortController.abort();
		currentAbortController = null;
	}
}

// ---- API Key Management ----

/** Initialize the store — load API key and provider settings from localStorage */
export function initAIChat(): void {
	const key = localStorage.getItem('yarner-api-key') || '';
	const savedProviderId = localStorage.getItem('yarner-provider-id');
	const savedApiUrl = localStorage.getItem('yarner-api-url');
	const savedModel = localStorage.getItem('yarner-model');

	// Resolve provider: use saved values or fall back to preset defaults
	const preset = PROVIDER_PRESETS.find((p) => p.id === savedProviderId) || defaultPreset;
	const providerId = preset.id;
	const apiUrl = savedApiUrl || preset.apiUrl;
	const model = savedModel || preset.defaultModel;

	aiChatStore.update((s) => ({ ...s, apiKey: key, providerId, apiUrl, model }));
}

/** Save the user's API key */
export function setApiKey(key: string): void {
	localStorage.setItem('yarner-api-key', key);
	aiChatStore.update((s) => ({ ...s, apiKey: key, error: '' }));
}

/** Remove the API key */
export function clearApiKey(): void {
	localStorage.removeItem('yarner-api-key');
	aiChatStore.update((s) => ({ ...s, apiKey: '' }));
}

/**
 * Switch to a different AI provider. Applies preset defaults for URL and model
 * unless custom values are provided. Persists to localStorage.
 */
export function setProvider(
	providerId: string,
	customApiUrl?: string,
	customModel?: string
): void {
	const preset = PROVIDER_PRESETS.find((p) => p.id === providerId);
	const apiUrl = customApiUrl || preset?.apiUrl || '';
	const model = customModel || preset?.defaultModel || '';

	localStorage.setItem('yarner-provider-id', providerId);
	localStorage.setItem('yarner-api-url', apiUrl);
	localStorage.setItem('yarner-model', model);

	aiChatStore.update((s) => ({ ...s, providerId, apiUrl, model, error: '' }));
}

// ---- Game History Diff ----

/** Maximum number of game history entries to send in a single diff */
const MAX_DIFF_ENTRIES = 50;

/**
 * Compute the game output that happened since the last AI interaction.
 * Returns the diff as a single string, capped at MAX_DIFF_ENTRIES.
 */
function getGameHistoryDiff(): string {
	const aiState = get(aiChatStore);
	const gameS = get(gameState);
	const allHistory = gameS.gameHistory;

	let diff = allHistory.slice(aiState.lastSentGameHistoryIndex);

	// Safety: cap very large diffs to avoid blowing up context
	if (diff.length > MAX_DIFF_ENTRIES) {
		diff = ['(... atividade anterior omitida por brevidade ...)\n', ...diff.slice(-MAX_DIFF_ENTRIES)];
	}

	return diff.join('');
}

// ---- Send Message to AI ----

/**
 * Send a user message to the Claude AI assistant.
 *
 * This is the main action function. It:
 * 1. Adds the user message to the conversation
 * 2. Computes the game history diff
 * 3. Calls the Claude API with streaming
 * 4. Parses the response (chat message + game status update)
 * 5. Persists everything to IndexedDB
 */
export async function sendMessageToAI(userMessage: string): Promise<void> {
	const state = get(aiChatStore);
	const gameS = get(gameState);

	// Cancel any previous request before starting a new one
	abortStreaming();
	currentAbortController = new AbortController();
	const { signal } = currentAbortController;

	// API key is optional for local servers (LM Studio, Ollama)

	// Add user message
	const userMsg: AIChatMessage = {
		role: 'user',
		content: userMessage,
		timestamp: Date.now()
	};

	aiChatStore.update((s) => ({
		...s,
		messages: [...s.messages, userMsg],
		isLoading: true,
		isStreaming: true,
		streamingContent: '',
		error: ''
	}));

	try {
		// Compute diff of game output since last AI call
		const diff = getGameHistoryDiff();

		// Build conversation history for the API (last 20 messages max)
		const currentState = get(aiChatStore);
		const recentMessages = currentState.messages.slice(-20);
		const conversationHistory = recentMessages.map((msg) => ({
			role: msg.role as 'user' | 'assistant',
			content: msg.content
		}));

		// Call AI with streaming (works with LM Studio, Gemini, OpenAI, etc.)
		const response = await sendToAIStreaming(
			state.apiKey,
			conversationHistory,
			diff,
			state.gameStatus,
			gameS.gameName,
			(partialText) => {
				// Update streaming content for live display
				aiChatStore.update((s) => ({ ...s, streamingContent: partialText }));
			},
			state.apiUrl,
			state.model,
			signal
		);

		// Add assistant response to messages
		const assistantMsg: AIChatMessage = {
			role: 'assistant',
			content: response.message,
			timestamp: Date.now()
		};

		aiChatStore.update((s) => ({
			...s,
			messages: [...s.messages, assistantMsg],
			gameStatus: response.updatedGameStatus,
			lastSentGameHistoryIndex: gameS.gameHistory.length,
			isLoading: false,
			isStreaming: false,
			streamingContent: ''
		}));

		// Persist to IndexedDB
		const finalState = get(aiChatStore);
		if (gameS.gameName) {
			await saveGameStatus(gameS.gameName, finalState.gameStatus);
			await saveChatHistory(gameS.gameName, finalState.messages);
		}
	} catch (error) {
		// AbortError is intentional (new game loaded, reset, etc.) — clean up silently
		if (error instanceof DOMException && error.name === 'AbortError') {
			aiChatStore.update((s) => ({
				...s,
				isLoading: false,
				isStreaming: false,
				streamingContent: ''
			}));
			return;
		}
		aiChatStore.update((s) => ({
			...s,
			isLoading: false,
			isStreaming: false,
			streamingContent: '',
			error: getErrorMessage(error)
		}));
	} finally {
		currentAbortController = null;
	}
}

// ---- State Management ----

/** Load persisted AI state for a specific game (called when game loads) */
export async function loadAIStateForGame(gameName: string): Promise<void> {
	// If a stream is active (e.g. user loaded a new game mid-response), kill it first
	abortStreaming();
	const savedStatus = await loadGameStatus(gameName);
	const savedMessages = await loadChatHistory(gameName);

	aiChatStore.update((s) => ({
		...s,
		gameStatus: savedStatus || createEmptyGameStatus(),
		messages: savedMessages,
		lastSentGameHistoryIndex: 0,
		error: ''
	}));
}

/** Reset AI chat state (when game changes or is unloaded) */
export function resetAIChat(): void {
	abortStreaming();
	const s = get(aiChatStore);
	aiChatStore.set({
		...initialState,
		// Preserve provider config across game changes
		apiKey: s.apiKey,
		providerId: s.providerId,
		apiUrl: s.apiUrl,
		model: s.model
	});
}

/**
 * Restaura o status de IA a partir de um slot de save.
 * Chamado após loadFromSaveSlot() para sincronizar o assistente com o estado salvo.
 *
 * @param savedStatus - GameStatus armazenado no slot (pode ser undefined para saves antigos)
 * @param gameHistoryLength - Tamanho do gameHistory restaurado (atualiza o smart diff index)
 * @param savedMessages - Mensagens do chat salvas no slot (pode ser undefined para saves antigos)
 */
export async function restoreAIStatusFromSave(
	savedStatus: import('./aiPersistence').GameStatus | undefined,
	gameHistoryLength: number,
	savedMessages?: import('./aiPersistence').AIChatMessage[]
): Promise<void> {
	const gameS = get(gameState);
	const statusToRestore = savedStatus ?? createEmptyGameStatus();
	const messagesToRestore = savedMessages ?? [];

	aiChatStore.update(s => ({
		...s,
		messages: messagesToRestore,
		gameStatus: statusToRestore,
		// Aponta o smart diff para o fim do histórico restaurado
		// para que a IA não reenvie tudo o que já foi processado
		lastSentGameHistoryIndex: gameHistoryLength,
		error: ''
	}));

	if (gameS.gameName) {
		await saveGameStatus(gameS.gameName, statusToRestore);
		await saveChatHistory(gameS.gameName, messagesToRestore);
	}
}

/**
 * Reseta o estado de IA para um restart de jogo:
 * - Zera o game status (localização, inventário, etc.)
 * - Limpa mensagens do chat (não são mais relevantes para o estado reiniciado)
 * - Persiste o estado zerado no IndexedDB
 *
 * Chamado por GamePanel quando o usuário confirma o restart.
 */
export async function resetAIStateForRestart(): Promise<void> {
	const gameS = get(gameState);
	const emptyStatus = createEmptyGameStatus();

	aiChatStore.update(s => ({
		...s,
		messages: [],
		gameStatus: emptyStatus,
		lastSentGameHistoryIndex: 0,
		error: ''
	}));

	if (gameS.gameName) {
		await saveGameStatus(gameS.gameName, emptyStatus);
		await saveChatHistory(gameS.gameName, []);
	}
}

/**
 * Clear chat messages but keep the game status as persistent memory.
 *
 * The game status acts as a summary of everything the AI knows so far,
 * so the next conversation starts with context without needing the full log.
 * Also persists the cleared state to IndexedDB.
 */
export async function clearChatMessages(): Promise<void> {
	const gameS = get(gameState);

	aiChatStore.update((s) => ({
		...s,
		messages: [],
		lastSentGameHistoryIndex: gameS.gameHistory.length, // Skip re-sending old game output
		error: ''
	}));

	// Persist cleared messages (game status stays intact in IndexedDB)
	if (gameS.gameName) {
		await saveChatHistory(gameS.gameName, []);
	}
}

// ---- Derived Stores ----

/** Controls whether the location map is expanded to a third column */
export const locationMapExpanded = writable(false);

export const aiMessages = derived(aiChatStore, ($s) => $s.messages);
export const aiGameStatus = derived(aiChatStore, ($s) => $s.gameStatus);
export const aiIsLoading = derived(aiChatStore, ($s) => $s.isLoading);
export const aiIsStreaming = derived(aiChatStore, ($s) => $s.isStreaming);
export const aiStreamingContent = derived(aiChatStore, ($s) => $s.streamingContent);
export const aiError = derived(aiChatStore, ($s) => $s.error);
export const aiHasKey = derived(aiChatStore, ($s) => $s.apiKey.length > 0);
export const aiProviderId = derived(aiChatStore, ($s) => $s.providerId);
export const aiApiUrl = derived(aiChatStore, ($s) => $s.apiUrl);
export const aiModel = derived(aiChatStore, ($s) => $s.model);

/** Export the store with its action functions */
export const aiChat = {
	subscribe: aiChatStore.subscribe,
	initAIChat,
	setApiKey,
	clearApiKey,
	setProvider,
	sendMessageToAI,
	loadAIStateForGame,
	resetAIChat,
	resetAIStateForRestart,
	restoreAIStatusFromSave,
	clearChatMessages
};
