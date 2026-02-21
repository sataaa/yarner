import { describe, it, expect } from 'vitest';
import { parseAIResponse, tryRepairAndParseJSON, getErrorMessage } from './claude';
import type { GameStatus } from '$lib/stores/aiPersistence';

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
		// Original location must survive
		expect(result.updatedGameStatus.locaisVisitados['West of House']).toBeDefined();
		// New location must be added
		expect(result.updatedGameStatus.locaisVisitados['Forest']).toBeDefined();
	});

	it('preserves existing locaisVisitados when model returns empty {}', () => {
		const statusWithLocations: GameStatus = {
			...fallback,
			locaisVisitados: {
				'West of House': { saidas: {}, notas: [] }
			}
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
		const result = tryRepairAndParseJSON('{"key":"value"}');
		expect(result).toEqual({ key: 'value' });
	});

	it('repairs truncated JSON with unclosed brace and bracket', () => {
		const truncated = '{"localizacaoAtual":"West of House","inventario":[';
		const result = tryRepairAndParseJSON(truncated);
		expect(result).not.toBeNull();
		expect((result as Record<string, unknown>).localizacaoAtual).toBe('West of House');
	});

	it('returns null for completely invalid input', () => {
		expect(tryRepairAndParseJSON('this is not json at all!!!')).toBeNull();
	});

	it('handles nested objects correctly', () => {
		const json = '{"a":{"b":1},"c":[1,2,3]}';
		expect(tryRepairAndParseJSON(json)).toEqual({ a: { b: 1 }, c: [1, 2, 3] });
	});
});

// ---------------------------------------------------------------------------
// getErrorMessage
// ---------------------------------------------------------------------------

describe('getErrorMessage', () => {
	it('returns connection error message for fetch TypeError', () => {
		const err = new TypeError('Failed to fetch');
		expect(getErrorMessage(err)).toContain('servidor');
	});

	it('returns auth error message for 401', () => {
		const err = new Error('API error (401): Unauthorized');
		expect(getErrorMessage(err)).toContain('API');
	});

	it('returns rate limit message for 429', () => {
		const err = new Error('API error (429): Too Many Requests');
		expect(getErrorMessage(err)).toContain('Limite');
	});

	it('returns the error message for generic errors', () => {
		const err = new Error('Something broke');
		expect(getErrorMessage(err)).toContain('Something broke');
	});

	it('returns generic unknown message for non-Error values', () => {
		expect(getErrorMessage('unexpected string')).toContain('desconhecido');
		expect(getErrorMessage(null)).toContain('desconhecido');
	});
});
