import { describe, it, expect, afterEach, vi } from 'vitest';
import { parseAIResponse, applyMemoryOperations, buildSystemPrompt, getErrorMessage, sendToAIStreaming, fetchAvailableModels, PROVIDER_PRESETS } from './claude';
import type { ProviderPreset } from './claude';
import type { AIMemory } from '$lib/stores/aiPersistence';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const emptyMemory: AIMemory = [];

/**
 * Build a ReadableStream that emits SSE chunks, as a real streaming API would.
 * Each string in `parts` becomes one SSE data line with a JSON delta payload.
 */
function makeSSEStream(parts: string[]): ReadableStream<Uint8Array> {
	const encoder = new TextEncoder();
	return new ReadableStream({
		start(controller) {
			for (const part of parts) {
				const line = `data: ${JSON.stringify({ choices: [{ delta: { content: part } }] })}\n\n`;
				controller.enqueue(encoder.encode(line));
			}
			controller.enqueue(encoder.encode('data: [DONE]\n\n'));
			controller.close();
		}
	});
}

afterEach(() => {
	vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// sendToAIStreaming
// ---------------------------------------------------------------------------

describe('sendToAIStreaming', () => {
	it('sends a POST request with Authorization header when apiKey is provided', async () => {
		const mockFetch = vi.fn().mockResolvedValue({ ok: true, body: makeSSEStream(['ok']) });
		vi.stubGlobal('fetch', mockFetch);

		await sendToAIStreaming('my-key', [], '', emptyMemory, 'Zork', () => {});

		expect(mockFetch).toHaveBeenCalledOnce();
		const [, options] = mockFetch.mock.calls[0];
		expect(options.method).toBe('POST');
		expect(options.headers['Authorization']).toBe('Bearer my-key');
	});

	it('omits Authorization header when apiKey is empty', async () => {
		const mockFetch = vi.fn().mockResolvedValue({ ok: true, body: makeSSEStream(['ok']) });
		vi.stubGlobal('fetch', mockFetch);

		await sendToAIStreaming('', [], '', emptyMemory, 'Zork', () => {});

		const [, options] = mockFetch.mock.calls[0];
		expect(options.headers).not.toHaveProperty('Authorization');
	});

	it('calls onStream callback with progressively accumulated text', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: true,
			body: makeSSEStream(['Hello', ' world'])
		}));

		const calls: string[] = [];
		await sendToAIStreaming('', [], '', emptyMemory, 'Zork', (text) => calls.push(text));

		expect(calls).toEqual(['Hello', 'Hello world']);
	});

	it('parses memory updates from the streamed response', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: true,
			body: makeSSEStream([
				'Dica aqui.\nMEMORY_UPDATE_START\n',
				'ADD Jogador está na floresta\n',
				'MEMORY_UPDATE_END'
			])
		}));

		const result = await sendToAIStreaming('', [], '', emptyMemory, 'Zork', () => {});

		expect(result.updatedMemory).toEqual(['Jogador está na floresta']);
		expect(result.message).not.toContain('MEMORY_UPDATE_START');
	});

	it('passes the AbortSignal to fetch', async () => {
		const mockFetch = vi.fn().mockResolvedValue({ ok: true, body: makeSSEStream(['ok']) });
		vi.stubGlobal('fetch', mockFetch);
		const controller = new AbortController();

		await sendToAIStreaming('', [], '', emptyMemory, 'Zork', () => {}, undefined, undefined, controller.signal);

		const [, options] = mockFetch.mock.calls[0];
		expect(options.signal).toBe(controller.signal);
	});

	it('throws with status code on non-2xx response', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: false,
			status: 401,
			statusText: 'Unauthorized',
			text: () => Promise.resolve('Unauthorized')
		}));

		await expect(sendToAIStreaming('', [], '', emptyMemory, 'Zork', () => {}))
			.rejects.toThrow('401');
	});

	it('throws when response body is null', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, body: null }));

		await expect(sendToAIStreaming('', [], '', emptyMemory, 'Zork', () => {}))
			.rejects.toThrow('No response body');
	});

	it('uses the catch fallback when response.text() rejects', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: false,
			status: 500,
			statusText: 'Internal Server Error',
			text: () => Promise.reject(new Error('body read failed'))
		}));

		await expect(sendToAIStreaming('', [], '', emptyMemory, 'Zork', () => {}))
			.rejects.toThrow('500');
	});

	it('uses the provided model name in the request body', async () => {
		const mockFetch = vi.fn().mockResolvedValue({ ok: true, body: makeSSEStream(['ok']) });
		vi.stubGlobal('fetch', mockFetch);

		await sendToAIStreaming('key', [], '', emptyMemory, 'Zork', () => {}, undefined, 'gemini-2.5-flash');

		const [, options] = mockFetch.mock.calls[0];
		const body = JSON.parse(options.body);
		expect(body.model).toBe('gemini-2.5-flash');
	});

	it('uses the provided API URL instead of the default', async () => {
		const mockFetch = vi.fn().mockResolvedValue({ ok: true, body: makeSSEStream(['ok']) });
		vi.stubGlobal('fetch', mockFetch);

		const customUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
		await sendToAIStreaming('key', [], '', emptyMemory, 'Zork', () => {}, customUrl);

		const [url] = mockFetch.mock.calls[0];
		expect(url).toBe(customUrl);
	});

	it('defaults to local-model when no model is specified', async () => {
		const mockFetch = vi.fn().mockResolvedValue({ ok: true, body: makeSSEStream(['ok']) });
		vi.stubGlobal('fetch', mockFetch);

		await sendToAIStreaming('', [], '', emptyMemory, 'Zork', () => {});

		const [, options] = mockFetch.mock.calls[0];
		const body = JSON.parse(options.body);
		expect(body.model).toBe('local-model');
	});

	it('processes remaining buffered data when stream ends without trailing newline', async () => {
		const encoder = new TextEncoder();
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: 'first' } }] })}\n\n`));
				controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: ' last' } }] })}`));
				controller.close();
			}
		});
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, body: stream }));

		const result = await sendToAIStreaming('', [], '', emptyMemory, 'Zork', () => {});
		expect(result.message).toBe('first last');
	});

	it('handles [DONE] in buffer without trailing newline', async () => {
		const encoder = new TextEncoder();
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: 'ok' } }] })}\n\n`));
				controller.enqueue(encoder.encode('data: [DONE]'));
				controller.close();
			}
		});
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, body: stream }));

		const result = await sendToAIStreaming('', [], '', emptyMemory, 'Zork', () => {});
		expect(result.message).toBe('ok');
	});

	it('ignores non-SSE data remaining in buffer', async () => {
		const encoder = new TextEncoder();
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: 'ok' } }] })}\n\n`));
				controller.enqueue(encoder.encode('some garbage'));
				controller.close();
			}
		});
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, body: stream }));

		const result = await sendToAIStreaming('', [], '', emptyMemory, 'Zork', () => {});
		expect(result.message).toBe('ok');
	});

	it('handles malformed JSON in buffer gracefully', async () => {
		const encoder = new TextEncoder();
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: 'ok' } }] })}\n\n`));
				controller.enqueue(encoder.encode('data: {invalid json}'));
				controller.close();
			}
		});
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, body: stream }));

		const result = await sendToAIStreaming('', [], '', emptyMemory, 'Zork', () => {});
		expect(result.message).toBe('ok');
	});

	it('skips malformed SSE lines without throwing', async () => {
		const encoder = new TextEncoder();
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(encoder.encode('data: {invalid json}\n\n'));
				controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: 'ok' } }] })}\n\n`));
				controller.enqueue(encoder.encode('data: [DONE]\n\n'));
				controller.close();
			}
		});
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, body: stream }));

		const result = await sendToAIStreaming('', [], '', emptyMemory, 'Zork', () => {});
		expect(result.message).toBe('ok');
	});
});

// ---------------------------------------------------------------------------
// parseAIResponse
// ---------------------------------------------------------------------------

describe('parseAIResponse', () => {
	it('strips MEMORY_UPDATE block and applies operations', () => {
		const text = 'Dica aqui.\nMEMORY_UPDATE_START\nADD Jogador está na floresta\nMEMORY_UPDATE_END';
		const result = parseAIResponse(text, []);
		expect(result.message).toBe('Dica aqui.');
		expect(result.updatedMemory).toEqual(['Jogador está na floresta']);
	});

	it('returns original memory when no block is present', () => {
		const memory = ['nota existente'];
		const result = parseAIResponse('Só texto sem bloco.', memory);
		expect(result.updatedMemory).toBe(memory);
		expect(result.message).toBe('Só texto sem bloco.');
	});

	it('strips the block from the visible message', () => {
		const text = 'Resposta visível.\nMEMORY_UPDATE_START\nADD nota\nMEMORY_UPDATE_END';
		const { message } = parseAIResponse(text, []);
		expect(message).toBe('Resposta visível.');
		expect(message).not.toContain('MEMORY_UPDATE_START');
	});

	it('handles empty block — no changes to memory', () => {
		const memory = ['nota existente'];
		const text = 'Dica.\nMEMORY_UPDATE_START\n\nMEMORY_UPDATE_END';
		const result = parseAIResponse(text, memory);
		expect(result.updatedMemory).toEqual(['nota existente']);
	});
});

// ---------------------------------------------------------------------------
// applyMemoryOperations
// ---------------------------------------------------------------------------

describe('applyMemoryOperations', () => {
	it('ADD appends a new note', () => {
		const result = applyMemoryOperations([], 'ADD Nova nota');
		expect(result).toEqual(['Nova nota']);
	});

	it('ADD multiple notes', () => {
		const result = applyMemoryOperations([], 'ADD Nota 1\nADD Nota 2');
		expect(result).toEqual(['Nota 1', 'Nota 2']);
	});

	it('REMOVE removes note by 1-based index', () => {
		const result = applyMemoryOperations(['a', 'b', 'c'], 'REMOVE 2');
		expect(result).toEqual(['a', 'c']);
	});

	it('UPDATE replaces note content by 1-based index', () => {
		const result = applyMemoryOperations(['antiga', 'outra'], 'UPDATE 1 atualizada');
		expect(result).toEqual(['atualizada', 'outra']);
	});

	it('handles mixed operations sequentially', () => {
		const result = applyMemoryOperations(
			['nota1', 'nota2', 'nota3'],
			'REMOVE 2\nADD nova nota\nUPDATE 1 nota1 atualizada'
		);
		// After REMOVE 2: ['nota1', 'nota3']
		// After ADD: ['nota1', 'nota3', 'nova nota']
		// After UPDATE 1: ['nota1 atualizada', 'nota3', 'nova nota']
		expect(result).toEqual(['nota1 atualizada', 'nota3', 'nova nota']);
	});

	it('ignores REMOVE with invalid index', () => {
		const result = applyMemoryOperations(['a'], 'REMOVE 5');
		expect(result).toEqual(['a']);
	});

	it('ignores REMOVE with index 0 (out of 1-based range)', () => {
		const result = applyMemoryOperations(['a'], 'REMOVE 0');
		expect(result).toEqual(['a']);
	});

	it('ignores UPDATE with invalid index', () => {
		const result = applyMemoryOperations(['a'], 'UPDATE 5 novo texto');
		expect(result).toEqual(['a']);
	});

	it('returns same array for empty block', () => {
		const result = applyMemoryOperations(['a', 'b'], '');
		expect(result).toEqual(['a', 'b']);
	});

	it('does not mutate the original memory array', () => {
		const original = ['a', 'b'];
		const result = applyMemoryOperations(original, 'ADD c');
		expect(original).toEqual(['a', 'b']);
		expect(result).toEqual(['a', 'b', 'c']);
	});

	it('respects the 20-note maximum', () => {
		const memory = Array.from({ length: 20 }, (_, i) => `nota ${i + 1}`);
		const result = applyMemoryOperations(memory, 'ADD esta não entra');
		expect(result).toHaveLength(20);
	});

	it('ignores unknown operation lines', () => {
		const result = applyMemoryOperations(['a'], 'UNKNOWN something\nADD b');
		expect(result).toEqual(['a', 'b']);
	});
});

// ---------------------------------------------------------------------------
// buildSystemPrompt
// ---------------------------------------------------------------------------

describe('buildSystemPrompt', () => {
	it('includes the game name', () => {
		const prompt = buildSystemPrompt('Zork', [], '');
		expect(prompt).toContain('Zork');
	});

	it('includes numbered memory notes when present', () => {
		const prompt = buildSystemPrompt('Zork', ['Estou na floresta', 'Tenho uma lanterna'], '');
		expect(prompt).toContain('1. Estou na floresta');
		expect(prompt).toContain('2. Tenho uma lanterna');
	});

	it('shows (vazio) when memory is empty', () => {
		const prompt = buildSystemPrompt('Zork', [], '');
		expect(prompt).toContain('(vazio)');
	});

	it('includes game history diff', () => {
		const prompt = buildSystemPrompt('Zork', [], 'West of House\nYou are standing...');
		expect(prompt).toContain('West of House');
	});
});

// ---------------------------------------------------------------------------
// getErrorMessage
// ---------------------------------------------------------------------------

describe('getErrorMessage', () => {
	it('returns connection error message for fetch TypeError', () => {
		expect(getErrorMessage(new TypeError('Failed to fetch'))).toContain('servidor');
	});

	it('returns auth error message for 401', () => {
		expect(getErrorMessage(new Error('API error (401): Unauthorized'))).toContain('API');
	});

	it('returns rate limit message for 429', () => {
		expect(getErrorMessage(new Error('API error (429): Too Many Requests'))).toContain('Limite');
	});

	it('returns the error message for generic errors', () => {
		expect(getErrorMessage(new Error('Something broke'))).toContain('Something broke');
	});

	it('returns generic unknown message for non-Error values', () => {
		expect(getErrorMessage('unexpected string')).toContain('desconhecido');
		expect(getErrorMessage(null)).toContain('desconhecido');
	});
});

// ---------------------------------------------------------------------------
// PROVIDER_PRESETS
// ---------------------------------------------------------------------------

describe('PROVIDER_PRESETS', () => {
	it('has at least 3 presets (lmstudio, gemini, openai)', () => {
		expect(PROVIDER_PRESETS.length).toBeGreaterThanOrEqual(3);
	});

	it('every preset has required fields', () => {
		for (const p of PROVIDER_PRESETS) {
			expect(p).toHaveProperty('id');
			expect(p).toHaveProperty('name');
			expect(p).toHaveProperty('apiUrl');
			expect(p).toHaveProperty('defaultModel');
			expect(typeof p.requiresKey).toBe('boolean');
		}
	});

	it('lmstudio preset does not require a key', () => {
		const lm = PROVIDER_PRESETS.find((p: ProviderPreset) => p.id === 'lmstudio');
		expect(lm).toBeDefined();
		expect(lm!.requiresKey).toBe(false);
	});

	it('gemini preset requires a key and uses the correct endpoint', () => {
		const gemini = PROVIDER_PRESETS.find((p: ProviderPreset) => p.id === 'gemini');
		expect(gemini).toBeDefined();
		expect(gemini!.requiresKey).toBe(true);
		expect(gemini!.apiUrl).toContain('generativelanguage.googleapis.com');
	});
});

// ---------------------------------------------------------------------------
// fetchAvailableModels
// ---------------------------------------------------------------------------

describe('fetchAvailableModels', () => {
	it('returns empty array for lmstudio provider', async () => {
		const result = await fetchAvailableModels('lmstudio', '');
		expect(result).toEqual([]);
	});

	it('returns empty array for custom provider', async () => {
		const result = await fetchAvailableModels('custom', '');
		expect(result).toEqual([]);
	});

	it('returns empty array for unknown provider', async () => {
		const result = await fetchAvailableModels('unknown', 'key');
		expect(result).toEqual([]);
	});

	it('fetches gemini models and filters by generateContent', async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({
				models: [
					{ name: 'models/gemma-3-27b', displayName: 'Gemma 3 27B', supportedGenerationMethods: ['generateContent'] },
					{ name: 'models/text-embedding', displayName: 'Text Embedding', supportedGenerationMethods: ['embedContent'] }
				]
			})
		});
		vi.stubGlobal('fetch', mockFetch);

		const result = await fetchAvailableModels('gemini', 'test-key');
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe('gemma-3-27b');
		expect(result[0].name).toBe('Gemma 3 27B');
	});

	it('returns empty array when gemini API fails', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
		const result = await fetchAvailableModels('gemini', 'key');
		expect(result).toEqual([]);
	});

	it('returns empty array for gemini without apiKey', async () => {
		const result = await fetchAvailableModels('gemini', '');
		expect(result).toEqual([]);
	});

	it('fetches openrouter models and filters :free', async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({
				data: [
					{ id: 'google/gemma-3:free', name: 'Gemma 3 Free' },
					{ id: 'openai/gpt-4o', name: 'GPT-4o' }
				]
			})
		});
		vi.stubGlobal('fetch', mockFetch);

		const result = await fetchAvailableModels('openrouter', '');
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe('google/gemma-3:free');
	});

	it('returns empty array when openrouter API fails', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
		const result = await fetchAvailableModels('openrouter', '');
		expect(result).toEqual([]);
	});

	it('returns empty array when fetch throws', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
		const result = await fetchAvailableModels('gemini', 'key');
		expect(result).toEqual([]);
	});
});
