/**
 * AI API Client — OpenAI-compatible API communication
 *
 * Supports both local LLM servers (LM Studio, Ollama) and cloud APIs
 * (Anthropic, OpenAI) through the OpenAI chat/completions format.
 *
 * Default: connects to LM Studio at localhost:55511
 *
 * Response format: The AI returns a natural language message optionally followed
 * by a MEMORY_UPDATE block containing ADD/REMOVE/UPDATE operations on a list of notes.
 */

import type { AIMemory } from '../stores/aiPersistence';
import { get } from 'svelte/store';
import { t } from 'svelte-i18n';

/** Model option for provider dropdown */
export interface ModelOption {
	id: string;
	name: string;
}

/** Provider preset — predefined configuration for a known AI provider */
export interface ProviderPreset {
	id: string;
	name: string;
	apiUrl: string;
	defaultModel: string;
	requiresKey: boolean;
}

/** Available provider presets (all OpenAI-compatible endpoints) */
export const PROVIDER_PRESETS: ProviderPreset[] = [
	{
		id: 'lmstudio',
		name: 'LM Studio (local)',
		apiUrl: 'http://localhost:55511/v1/chat/completions',
		defaultModel: 'local-model',
		requiresKey: false
	},
	{
		id: 'gemini',
		name: 'Google Gemini',
		apiUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
		defaultModel: 'gemma-3-27b-it',
		requiresKey: true
	},
	{
		id: 'openai',
		name: 'OpenAI',
		apiUrl: 'https://api.openai.com/v1/chat/completions',
		defaultModel: 'gpt-4o-mini',
		requiresKey: true
	},
	{
		id: 'openrouter',
		name: 'OpenRouter',
		apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
		defaultModel: 'google/gemma-3-27b-it:free',
		requiresKey: true
	},
	{
		id: 'custom',
		name: 'Custom',
		apiUrl: '',
		defaultModel: '',
		requiresKey: false
	}
];

/** Default endpoint for local LM Studio server (browser connects directly) */
const DEFAULT_API_URL = 'http://localhost:55511/v1/chat/completions';

/** Default model name (overridden by provider presets) */
const DEFAULT_MODEL = 'local-model';

/** Maximum number of notes the AI memory can hold */
const MAX_MEMORY_NOTES = 20;

/** Parsed AI response: visible chat message + updated memory */
export interface AIResponse {
	message: string;
	updatedMemory: AIMemory;
}

/** Callback invoked during streaming with the accumulated text so far */
export type StreamCallback = (partialText: string) => void;

/**
 * Send a message to the AI with streaming response via OpenAI-compatible API.
 *
 * @param apiKey - API key (optional for local servers like LM Studio)
 * @param conversationHistory - Previous messages in the chat (user + assistant)
 * @param gameHistoryDiff - New game output since last AI interaction
 * @param currentMemory - Current AI memory notes
 * @param gameName - Name of the game being played
 * @param onStream - Callback for streaming partial responses
 * @param apiUrl - Override the API endpoint URL
 * @param model - Model name to use (defaults to 'local-model')
 * @returns Parsed response with chat message and updated memory
 */
export async function sendToAIStreaming(
	apiKey: string,
	conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
	gameHistoryDiff: string,
	currentMemory: AIMemory,
	gameName: string,
	onStream: StreamCallback,
	apiUrl: string = DEFAULT_API_URL,
	model: string = DEFAULT_MODEL,
	signal?: AbortSignal
): Promise<AIResponse> {
	const systemPrompt = buildSystemPrompt(gameName, currentMemory, gameHistoryDiff);

	// Gemma não suporta system role — injeta como primeira mensagem user
	const supportsSystem = !model.toLowerCase().includes('gemma');
	const messages = supportsSystem
		? [{ role: 'system', content: systemPrompt }, ...conversationHistory]
		: [{ role: 'user', content: `${get(t)('gemmaWorkaround.instructions')}\n${systemPrompt}` }, { role: 'assistant', content: get(t)('gemmaWorkaround.acknowledged') }, ...conversationHistory];

	const requestBody = {
		model,
		messages,
		stream: true,
		max_tokens: 2048,
		temperature: 0.7
	};

	const response = await fetch(apiUrl, {
		method: 'POST',
		mode: 'cors',
		headers: {
			'Content-Type': 'application/json',
			...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {})
		},
		body: JSON.stringify(requestBody),
		signal
	});

	if (!response.ok) {
		const errorText = await response.text().catch(() => '');
		throw new Error(`API error (${response.status}): ${errorText || response.statusText}`);
	}

	if (!response.body) {
		throw new Error('No response body received from AI server');
	}

	// Process the SSE (Server-Sent Events) stream.
	// Some providers (notably Gemini) may split a single `data:` line across
	// multiple chunks, so we buffer incomplete lines between reads.
	let fullResponse = '';
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });

			// Split on newlines but keep the last (possibly incomplete) segment
			const parts = buffer.split('\n');
			buffer = parts.pop() ?? '';

			for (const line of parts) {
				const trimmed = line.trim();
				if (!trimmed || !trimmed.startsWith('data: ')) continue;

				const data = trimmed.slice(6); // Remove 'data: ' prefix
				if (data === '[DONE]') continue;

				try {
					const parsed = JSON.parse(data);
					const delta = parsed.choices?.[0]?.delta?.content;
					if (delta) {
						fullResponse += delta;
						onStream(fullResponse);
					}
				} catch {
					// Skip malformed JSON lines (common in SSE streams)
				}
			}
		}

		// Process any remaining buffered data after the stream ends
		if (buffer.trim()) {
			const trimmed = buffer.trim();
			if (trimmed.startsWith('data: ')) {
				const data = trimmed.slice(6);
				if (data !== '[DONE]') {
					try {
						const parsed = JSON.parse(data);
						const delta = parsed.choices?.[0]?.delta?.content;
						if (delta) {
							fullResponse += delta;
							onStream(fullResponse);
						}
					} catch { /* ignore */ }
				}
			}
		}
	} finally {
		reader.releaseLock();
	}

	return parseAIResponse(fullResponse, currentMemory);
}

/**
 * Build the system prompt that gives the AI all the context it needs.
 *
 * The prompt instructs the AI to:
 * 1. Act as a helpful text adventure assistant (in PT-BR)
 * 2. Analyze the game output diff
 * 3. Optionally return memory update operations at the end of each response
 */
/** @internal Exported for unit testing */
export function buildSystemPrompt(
	gameName: string,
	memory: AIMemory,
	gameHistoryDiff: string
): string {
	const translate = get(t);
	const memorySection = memory.length > 0
		? memory.map((note, i) => `${i + 1}. ${note}`).join('\n')
		: translate('systemPrompt.empty');

	return `${translate('systemPrompt.role', { values: { gameName } })}

${translate('systemPrompt.duties')}

${translate('systemPrompt.contextHeader')}
${gameHistoryDiff || translate('systemPrompt.noNews')}

${translate('systemPrompt.notesHeader')}
${memorySection}

${translate('systemPrompt.notesInstruction')}

MEMORY_UPDATE_START
ADD texto da nova nota
REMOVE 3
UPDATE 1 texto atualizado da nota
MEMORY_UPDATE_END

${translate('systemPrompt.rules', { values: { max: String(MAX_MEMORY_NOTES) } })}`;
}

/**
 * Parse AI response to extract the visible message and apply memory operations.
 *
 * The AI may append a MEMORY_UPDATE_START...MEMORY_UPDATE_END block at the end.
 * We extract it, apply the operations, and return the clean message separately.
 */
/** @internal Exported for unit testing */
export function parseAIResponse(fullText: string, currentMemory: AIMemory): AIResponse {
	const regex = /MEMORY_UPDATE_START\s*([\s\S]*?)\s*MEMORY_UPDATE_END/;
	const match = fullText.match(regex);

	if (!match) {
		return { message: fullText.trim(), updatedMemory: currentMemory };
	}

	const message = fullText.replace(regex, '').trim();
	const updatedMemory = applyMemoryOperations(currentMemory, match[1].trim());

	return { message, updatedMemory };
}

/**
 * Apply ADD/REMOVE/UPDATE operations to the memory.
 * Operations are processed sequentially — REMOVE shifts indices.
 */
/** @internal Exported for unit testing */
export function applyMemoryOperations(memory: AIMemory, block: string): AIMemory {
	if (!block) return memory;

	const result = [...memory];
	const lines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);

	for (const line of lines) {
		if (line.startsWith('ADD ')) {
			const text = line.slice(4).trim();
			if (text && result.length < MAX_MEMORY_NOTES) {
				result.push(text);
			}
		} else if (line.startsWith('REMOVE ')) {
			const idx = parseInt(line.slice(7).trim(), 10) - 1; // 1-based → 0-based
			if (idx >= 0 && idx < result.length) {
				result.splice(idx, 1);
			}
		} else if (line.startsWith('UPDATE ')) {
			const rest = line.slice(7).trim();
			const spaceIdx = rest.indexOf(' ');
			if (spaceIdx > 0) {
				const idx = parseInt(rest.slice(0, spaceIdx), 10) - 1; // 1-based → 0-based
				const text = rest.slice(spaceIdx + 1).trim();
				if (idx >= 0 && idx < result.length && text) {
					result[idx] = text;
				}
			}
		}
	}

	return result;
}

/**
 * Busca modelos disponíveis para o provider selecionado.
 * - Gemini: lista da API do Google AI Studio (filtra modelos generateContent)
 * - OpenRouter: lista da API pública (filtra modelos :free)
 * - Outros: retorna array vazio (input de texto livre)
 */
export async function fetchAvailableModels(
	providerId: string,
	apiKey: string
): Promise<ModelOption[]> {
	try {
		if (providerId === 'gemini' && apiKey) {
			const resp = await fetch(
				`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
			);
			if (!resp.ok) return [];
			const data = await resp.json();
			return (data.models || [])
				.filter((m: { supportedGenerationMethods?: string[] }) =>
					m.supportedGenerationMethods?.includes('generateContent')
				)
				.map((m: { name: string; displayName: string }) => ({
					id: m.name.replace('models/', ''),
					name: m.displayName
				}))
				.sort((a: ModelOption, b: ModelOption) => a.name.localeCompare(b.name));
		}

		if (providerId === 'openrouter') {
			const resp = await fetch('https://openrouter.ai/api/v1/models');
			if (!resp.ok) return [];
			const data = await resp.json();
			return (data.data || [])
				.filter((m: { id: string }) => m.id.endsWith(':free'))
				.map((m: { id: string; name: string }) => ({
					id: m.id,
					name: m.name
				}))
				.sort((a: ModelOption, b: ModelOption) => a.name.localeCompare(b.name));
		}
	} catch {
		// Falha silenciosa — usuário pode digitar manualmente
	}

	return [];
}

/**
 * Translate API errors to user-friendly Portuguese messages.
 */
export function getErrorMessage(error: unknown): string {
	const translate = get(t);
	if (error instanceof TypeError && (error as Error).message.includes('fetch')) {
		return translate('errors.connectionError');
	}
	if (error instanceof Error) {
		if (error.message.includes('401')) {
			return translate('errors.invalidApiKey');
		}
		if (error.message.includes('429')) {
			return translate('errors.rateLimit');
		}
		return translate('errors.apiError', { values: { message: error.message } });
	}
	return translate('errors.unknownError');
}
