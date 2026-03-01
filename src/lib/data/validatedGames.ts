/**
 * Jogos validados — lista hardcoded de jogos conhecidos como jogáveis no Yarner.
 *
 * Cada entry mapeia o SHA-256 do arquivo do jogo para o nome canônico.
 * A biblioteca usa essa lista para exibir ✓ e o nome oficial do jogo.
 */

export interface ValidatedGame {
	name: string;
}

/** Mapa SHA-256 → dados do jogo validado */
export const VALIDATED_GAMES: Record<string, ValidatedGame> = {
	'0ae5ac229e79094ff368b6669356444af0f35e21d862a1baaa546989085c15fd': {
		name: 'Zork I: The Great Underground Empire'
	},
	'3ae7d5558943e9721f3e4b273c8a7faec1a03a604e1ae4ee1cde472c21cb24ac': {
		name: 'Zork II: The Wizard of Frobozz'
	}
};

/** Retorna o nome canônico de um jogo validado, ou undefined se não reconhecido */
export function getValidatedGameName(sha256: string): string | undefined {
	return VALIDATED_GAMES[sha256]?.name;
}

/** Verifica se um jogo (por SHA-256) está na lista de validados */
export function isValidatedGame(sha256: string): boolean {
	return sha256 in VALIDATED_GAMES;
}
