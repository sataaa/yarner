/**
 * Bundled games — games shipped with Yarner that are seeded into the library
 * automatically on first launch (and re-seeded after "Clear all data").
 */

import { base } from '$app/paths';
import { getGameFromLibrary, addGameToLibrary } from '$lib/stores/aiPersistence';

const BUNDLED: { sha256: string; filename: string; gameName: string; path: string }[] = [
	{
		sha256: '03c19b3730f1b46b6e882944a255d1d58e4148e51fcce423dcd96792f476ebfa',
		filename: 'advent.z3',
		gameName: 'advent',
		path: '/games/advent.z3'
	}
];

export async function seedBundledGames(): Promise<void> {
	for (const game of BUNDLED) {
		const existing = await getGameFromLibrary(game.sha256);
		if (existing?.bundled) continue; // already seeded
		if (existing && !existing.bundled) {
			// Migration: user had uploaded it before — just add the bundled flag
			await addGameToLibrary({ ...existing, bundled: true });
			continue;
		}
		// First time: fetch and store
		const res = await fetch(`${base}${game.path}`);
		if (!res.ok) continue; // graceful degradation
		const data = await res.arrayBuffer();
		const now = new Date().toISOString();
		await addGameToLibrary({
			sha256: game.sha256,
			filename: game.filename,
			gameName: game.gameName,
			fileSize: data.byteLength,
			addedDate: now,
			lastPlayed: now,
			gameData: data,
			bundled: true
		});
	}
}
