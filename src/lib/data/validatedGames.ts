/**
 * Validated games — hardcoded list of games known to be playable in Yarner.
 *
 * Each entry maps the game file's SHA-256 to its canonical name.
 * The library uses this list to display a ✓ badge and the official game name.
 */

export interface ValidatedGame {
	name: string;
}

/** SHA-256 → validated game data map */
export const VALIDATED_GAMES: Record<string, ValidatedGame> = {
	'0ae5ac229e79094ff368b6669356444af0f35e21d862a1baaa546989085c15fd': {
		name: 'Zork I: The Great Underground Empire'
	},
	'3ae7d5558943e9721f3e4b273c8a7faec1a03a604e1ae4ee1cde472c21cb24ac': {
		name: 'Zork II: The Wizard of Frobozz'
	}
};

/** Returns the canonical name of a validated game, or undefined if not recognized */
export function getValidatedGameName(sha256: string): string | undefined {
	return VALIDATED_GAMES[sha256]?.name;
}

/** Checks whether a game (by SHA-256) is in the validated list */
export function isValidatedGame(sha256: string): boolean {
	return sha256 in VALIDATED_GAMES;
}
