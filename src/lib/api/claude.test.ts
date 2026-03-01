import { describe, it, expect, afterEach, vi } from 'vitest';
import { parseAIResponse, tryRepairAndParseJSON, getErrorMessage, sendToAIStreaming, PROVIDER_PRESETS } from './claude';
import type { ProviderPreset } from './claude';
import type { GameStatus } from '$lib/stores/aiPersistence';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fallback: GameStatus = {
	localizacaoAtual: 'Unknown',
	inventario: [],
	objetivos: [],
	coisasNaoExploradas: [],
	observacoes: [],
	locaisVisitados: {},
	ultimaAtualizacao: '2026-01-01T00:00:00.000Z'
};

const makeStatusJson = (loc: string) =>
	`{"localizacaoAtual":"${loc}","inventario":[],"objetivos":[],"coisasNaoExploradas":[],"observacoes":[],"locaisVisitados":{},"ultimaAtualizacao":"2026-01-01T00:00:00.000Z"}`;

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

		await sendToAIStreaming('my-key', [], '', fallback, 'Zork', () => {});

		expect(mockFetch).toHaveBeenCalledOnce();
		const [, options] = mockFetch.mock.calls[0];
		expect(options.method).toBe('POST');
		expect(options.headers['Authorization']).toBe('Bearer my-key');
	});

	it('omits Authorization header when apiKey is empty', async () => {
		const mockFetch = vi.fn().mockResolvedValue({ ok: true, body: makeSSEStream(['ok']) });
		vi.stubGlobal('fetch', mockFetch);

		await sendToAIStreaming('', [], '', fallback, 'Zork', () => {});

		const [, options] = mockFetch.mock.calls[0];
		expect(options.headers).not.toHaveProperty('Authorization');
	});

	it('calls onStream callback with progressively accumulated text', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: true,
			body: makeSSEStream(['Hello', ' world'])
		}));

		const calls: string[] = [];
		await sendToAIStreaming('', [], '', fallback, 'Zork', (text) => calls.push(text));

		expect(calls).toEqual(['Hello', 'Hello world']);
	});

	it('parses game status from the streamed response', async () => {
		const statusJson = makeStatusJson('Forest');
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: true,
			body: makeSSEStream([
				'Dica aqui.\nGAME_STATUS_JSON_START\n',
				statusJson,
				'\nGAME_STATUS_JSON_END'
			])
		}));

		const result = await sendToAIStreaming('', [], '', fallback, 'Zork', () => {});

		expect(result.updatedGameStatus.localizacaoAtual).toBe('Forest');
		expect(result.message).not.toContain('GAME_STATUS_JSON_START');
	});

	it('passes the AbortSignal to fetch', async () => {
		const mockFetch = vi.fn().mockResolvedValue({ ok: true, body: makeSSEStream(['ok']) });
		vi.stubGlobal('fetch', mockFetch);
		const controller = new AbortController();

		await sendToAIStreaming('', [], '', fallback, 'Zork', () => {}, undefined, undefined, controller.signal);

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

		await expect(sendToAIStreaming('', [], '', fallback, 'Zork', () => {}))
			.rejects.toThrow('401');
	});

	it('throws when response body is null', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, body: null }));

		await expect(sendToAIStreaming('', [], '', fallback, 'Zork', () => {}))
			.rejects.toThrow('No response body');
	});

	it('uses the catch fallback when response.text() rejects', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: false,
			status: 500,
			statusText: 'Internal Server Error',
			text: () => Promise.reject(new Error('body read failed'))
		}));

		// The catch(() => '') runs, so errorText = '' and statusText is used instead
		await expect(sendToAIStreaming('', [], '', fallback, 'Zork', () => {}))
			.rejects.toThrow('500');
	});

	it('uses the provided model name in the request body', async () => {
		const mockFetch = vi.fn().mockResolvedValue({ ok: true, body: makeSSEStream(['ok']) });
		vi.stubGlobal('fetch', mockFetch);

		await sendToAIStreaming('key', [], '', fallback, 'Zork', () => {}, undefined, 'gemini-2.5-flash');

		const [, options] = mockFetch.mock.calls[0];
		const body = JSON.parse(options.body);
		expect(body.model).toBe('gemini-2.5-flash');
	});

	it('uses the provided API URL instead of the default', async () => {
		const mockFetch = vi.fn().mockResolvedValue({ ok: true, body: makeSSEStream(['ok']) });
		vi.stubGlobal('fetch', mockFetch);

		const customUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
		await sendToAIStreaming('key', [], '', fallback, 'Zork', () => {}, customUrl);

		const [url] = mockFetch.mock.calls[0];
		expect(url).toBe(customUrl);
	});

	it('defaults to local-model when no model is specified', async () => {
		const mockFetch = vi.fn().mockResolvedValue({ ok: true, body: makeSSEStream(['ok']) });
		vi.stubGlobal('fetch', mockFetch);

		await sendToAIStreaming('', [], '', fallback, 'Zork', () => {});

		const [, options] = mockFetch.mock.calls[0];
		const body = JSON.parse(options.body);
		expect(body.model).toBe('local-model');
	});

	it('processes remaining buffered data when stream ends without trailing newline', async () => {
		const encoder = new TextEncoder();
		// Last chunk has no trailing \n — data stays in buffer until stream ends
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: 'first' } }] })}\n\n`));
				// No trailing newline — this will remain in the buffer
				controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: ' last' } }] })}`));
				controller.close();
			}
		});
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, body: stream }));

		const result = await sendToAIStreaming('', [], '', fallback, 'Zork', () => {});
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

		const result = await sendToAIStreaming('', [], '', fallback, 'Zork', () => {});
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

		const result = await sendToAIStreaming('', [], '', fallback, 'Zork', () => {});
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

		const result = await sendToAIStreaming('', [], '', fallback, 'Zork', () => {});
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

		const result = await sendToAIStreaming('', [], '', fallback, 'Zork', () => {});
		expect(result.message).toBe('ok');
	});
});

// ---------------------------------------------------------------------------
// parseAIResponse
// ---------------------------------------------------------------------------

describe('parseAIResponse', () => {
	it('parses GAME_STATUS_JSON_START/END delimiter', () => {
		const text = `Minha dica.\nGAME_STATUS_JSON_START\n${makeStatusJson('West of House')}\nGAME_STATUS_JSON_END`;
		const result = parseAIResponse(text, fallback);
		expect(result.updatedGameStatus.localizacaoAtual).toBe('West of House');
	});

	it('strips the JSON block from the visible message', () => {
		const text = `Resposta visível.\nGAME_STATUS_JSON_START\n${makeStatusJson('Forest')}\nGAME_STATUS_JSON_END`;
		const { message } = parseAIResponse(text, fallback);
		expect(message).toBe('Resposta visível.');
		expect(message).not.toContain('GAME_STATUS_JSON_START');
		expect(message).not.toContain('localizacaoAtual');
	});

	it('parses ```game-status``` delimiter', () => {
		const text = `Dica.\n\`\`\`game-status\n${makeStatusJson('Kitchen')}\n\`\`\``;
		const result = parseAIResponse(text, fallback);
		expect(result.updatedGameStatus.localizacaoAtual).toBe('Kitchen');
	});

	it('falls back to fallbackStatus when no JSON block is present', () => {
		const result = parseAIResponse('Só texto sem bloco de status.', fallback);
		expect(result.updatedGameStatus).toEqual(fallback);
		expect(result.message).toBe('Só texto sem bloco de status.');
	});

	it('falls back to fallbackStatus when JSON is malformed', () => {
		const text = `Dica.\nGAME_STATUS_JSON_START\n{invalid json!!!\nGAME_STATUS_JSON_END`;
		const result = parseAIResponse(text, fallback);
		expect(result.updatedGameStatus).toEqual(fallback);
	});

	it('falls back when parsed JSON has neither localizacaoAtual nor inventario (covers || right side)', () => {
		// parsed is non-null but has no recognized fields → condition evaluates right side of ||
		const unknownJson = `{"someOtherField":"value","count":1}`;
		const text = `Dica.\nGAME_STATUS_JSON_START\n${unknownJson}\nGAME_STATUS_JSON_END`;
		const result = parseAIResponse(text, fallback);
		// Neither field is present → updatedGameStatus stays as fallback
		expect(result.updatedGameStatus).toEqual(fallback);
	});

	it('updates status when only inventario is present (covers || right side as deciding factor)', () => {
		// localizacaoAtual is absent → left side of || is false → right side (inventario) decides
		const inventarioOnlyJson = `{"inventario":["sword","lantern"],"objetivos":[],"coisasNaoExploradas":[],"observacoes":[],"locaisVisitados":{},"ultimaAtualizacao":"2026-01-01T00:00:00.000Z"}`;
		const text = `Dica.\nGAME_STATUS_JSON_START\n${inventarioOnlyJson}\nGAME_STATUS_JSON_END`;
		const result = parseAIResponse(text, fallback);
		expect(result.updatedGameStatus.inventario).toEqual(['sword', 'lantern']);
	});

	it('merges locaisVisitados additively — does not overwrite existing entries', () => {
		const statusWithLocations: GameStatus = {
			...fallback,
			locaisVisitados: {
				'West of House': { saidas: { north: 'Forest' }, notas: ['mailbox here'] }
			}
		};
		const newLocJson = `{"localizacaoAtual":"Forest","inventario":[],"objetivos":[],"coisasNaoExploradas":[],"observacoes":[],"locaisVisitados":{"Forest":{"saidas":{"south":"West of House"},"notas":[]}},"ultimaAtualizacao":"2026-01-01T00:00:00.000Z"}`;
		const text = `Dica.\nGAME_STATUS_JSON_START\n${newLocJson}\nGAME_STATUS_JSON_END`;
		const result = parseAIResponse(text, statusWithLocations);
		expect(result.updatedGameStatus.locaisVisitados['West of House']).toBeDefined();
		expect(result.updatedGameStatus.locaisVisitados['Forest']).toBeDefined();
	});

	it('preserves existing locaisVisitados when model returns empty {}', () => {
		const statusWithLocations: GameStatus = {
			...fallback,
			locaisVisitados: { 'West of House': { saidas: {}, notas: [] } }
		};
		const emptyLocJson = `{"localizacaoAtual":"West of House","inventario":[],"objetivos":[],"coisasNaoExploradas":[],"observacoes":[],"locaisVisitados":{},"ultimaAtualizacao":"2026-01-01T00:00:00.000Z"}`;
		const text = `Dica.\nGAME_STATUS_JSON_START\n${emptyLocJson}\nGAME_STATUS_JSON_END`;
		const result = parseAIResponse(text, statusWithLocations);
		expect(result.updatedGameStatus.locaisVisitados['West of House']).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// tryRepairAndParseJSON
// ---------------------------------------------------------------------------

describe('tryRepairAndParseJSON', () => {
	it('parses valid JSON', () => {
		expect(tryRepairAndParseJSON('{"key":"value"}')).toEqual({ key: 'value' });
	});

	it('repairs truncated JSON with unclosed brace and bracket', () => {
		const result = tryRepairAndParseJSON('{"localizacaoAtual":"West of House","inventario":[');
		expect(result).not.toBeNull();
		expect((result as Record<string, unknown>).localizacaoAtual).toBe('West of House');
	});

	it('returns null for completely invalid input', () => {
		expect(tryRepairAndParseJSON('this is not json at all!!!')).toBeNull();
	});

	it('uses {} fallback when locaisVisitados is absent from parsed JSON', () => {
		// parsed.locaisVisitados is undefined → || {} kicks in (line 215 branch)
		const noLocJson = `{"localizacaoAtual":"Forest","inventario":[],"objetivos":[],"coisasNaoExploradas":[],"observacoes":[],"ultimaAtualizacao":"2026-01-01T00:00:00.000Z"}`;
		const text = `Dica.\nGAME_STATUS_JSON_START\n${noLocJson}\nGAME_STATUS_JSON_END`;
		const result = parseAIResponse(text, fallback);
		expect(result.updatedGameStatus.localizacaoAtual).toBe('Forest');
		expect(result.updatedGameStatus.locaisVisitados).toEqual({});
	});

	it('correctly tracks escape sequences inside strings', () => {
		// \\\\ in JS source = \\ in actual string = escaped backslash inside a JSON value.
		// Forces the scanner through esc=true (line 241) and if(esc) (line 240).
		const result = tryRepairAndParseJSON('{"key":"with \\\\ backslash","count":3');
		expect(result).not.toBeNull();
		expect((result as Record<string, unknown>).count).toBe(3);
	});

	it('handles a backslash outside a string (covers ch===\\\\ && !inStr branch)', () => {
		// A lone backslash outside a string is invalid JSON but should not throw;
		// it covers the ch==='\\' && inStr===false short-circuit path.
		const result = tryRepairAndParseJSON('{"count":3\\');
		// May or may not parse — what matters is no throw and the branch is exercised
		// (either repaired or null is acceptable)
		expect(() => tryRepairAndParseJSON('{"count":3\\')).not.toThrow();
	});

	it('handles JSON with inner closed brackets (covers the ] decrement branch)', () => {
		// The ']' closes the inner array (brackets--), then the outer '}' is missing.
		// The string value is complete so the repair produces valid JSON.
		const result = tryRepairAndParseJSON('{"arr":[1,2],"count":3');
		expect(result).not.toBeNull();
		expect((result as Record<string, unknown>).arr).toEqual([1, 2]);
		expect((result as Record<string, unknown>).count).toBe(3);
	});

	it('handles nested objects correctly', () => {
		expect(tryRepairAndParseJSON('{"a":{"b":1},"c":[1,2,3]}')).toEqual({ a: { b: 1 }, c: [1, 2, 3] });
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
