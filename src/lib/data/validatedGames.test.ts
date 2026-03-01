import { describe, it, expect } from 'vitest';
import {
	VALIDATED_GAMES,
	getValidatedGameName,
	isValidatedGame
} from './validatedGames';

const ZORK1_SHA = '0ae5ac229e79094ff368b6669356444af0f35e21d862a1baaa546989085c15fd';
const UNKNOWN_SHA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

describe('validatedGames', () => {
	describe('VALIDATED_GAMES', () => {
		it('contém Zork I', () => {
			expect(VALIDATED_GAMES[ZORK1_SHA]).toEqual({
				name: 'Zork I: The Great Underground Empire'
			});
		});
	});

	describe('getValidatedGameName', () => {
		it('retorna nome canônico para SHA conhecido', () => {
			expect(getValidatedGameName(ZORK1_SHA)).toBe('Zork I: The Great Underground Empire');
		});

		it('retorna undefined para SHA desconhecido', () => {
			expect(getValidatedGameName(UNKNOWN_SHA)).toBeUndefined();
		});

		it('retorna undefined para string vazia', () => {
			expect(getValidatedGameName('')).toBeUndefined();
		});
	});

	describe('isValidatedGame', () => {
		it('retorna true para SHA conhecido', () => {
			expect(isValidatedGame(ZORK1_SHA)).toBe(true);
		});

		it('retorna false para SHA desconhecido', () => {
			expect(isValidatedGame(UNKNOWN_SHA)).toBe(false);
		});

		it('retorna false para string vazia', () => {
			expect(isValidatedGame('')).toBe(false);
		});
	});
});
