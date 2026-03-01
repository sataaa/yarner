<script lang="ts">
	import { onMount } from 'svelte';
	import { slide } from 'svelte/transition';
	import { createEventDispatcher } from 'svelte';
	import {
		getGameLibrary,
		removeGameFromLibrary,
		getSaveSlots,
		type GameLibraryEntry,
		type SaveSlot
	} from '$lib/stores/aiPersistence';

	const dispatch = createEventDispatcher<{
		loadFromLibrary: { filename: string; data: ArrayBuffer };
		loadFromSave: { slot: SaveSlot };
	}>();

	let games: GameLibraryEntry[] = [];
	/** Últimos 3 saves de cada jogo, indexados por gameName */
	let savesPerGame: Record<string, SaveSlot[]> = {};
	let deletingSha: string | null = null;

	onMount(loadLibrary);

	/** Recarregar a lista (chamado pelo parent após adicionar jogo à biblioteca) */
	export async function refresh() {
		await loadLibrary();
	}

	async function loadLibrary() {
		games = await getGameLibrary();
		const saves: Record<string, SaveSlot[]> = {};
		for (const game of games) {
			const slots = await getSaveSlots(game.gameName);
			const sorted = Object.values(slots)
				.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
				.slice(0, 3);
			if (sorted.length > 0) {
				saves[game.gameName] = sorted;
			}
		}
		savesPerGame = saves;
	}

	function loadGame(entry: GameLibraryEntry) {
		dispatch('loadFromLibrary', {
			filename: entry.filename,
			data: entry.gameData
		});
	}

	function loadSave(slot: SaveSlot) {
		dispatch('loadFromSave', { slot });
	}

	function requestDelete(sha256: string) {
		deletingSha = sha256;
	}

	async function doDelete(sha256: string) {
		await removeGameFromLibrary(sha256);
		deletingSha = null;
		await loadLibrary();
	}

	function formatSize(bytes: number): string {
		return (bytes / 1024).toFixed(0) + ' KB';
	}

	function formatDate(iso: string): string {
		try {
			return new Date(iso).toLocaleDateString('pt-BR');
		} catch {
			return iso;
		}
	}

	function formatDateTime(iso: string): string {
		try {
			return new Date(iso).toLocaleString('pt-BR', {
				day: '2-digit', month: '2-digit',
				hour: '2-digit', minute: '2-digit'
			});
		} catch {
			return iso;
		}
	}
</script>

{#if games.length > 0}
	<div class="game-library">
		<h4>Jogos Recentes</h4>
		<div class="library-list">
			{#each games as game (game.sha256)}
				<div class="library-item-wrapper" transition:slide={{ duration: 150 }}>
					<div class="library-item" class:confirming={deletingSha === game.sha256}>
						{#if deletingSha === game.sha256}
							<span class="delete-confirm-text">Remover "{game.gameName}"?</span>
							<div class="item-actions">
								<button class="btn-danger-sm" on:click={() => doDelete(game.sha256)}>Remover</button>
								<button class="btn-cancel-sm" on:click={() => deletingSha = null}>Cancelar</button>
							</div>
						{:else}
							<button class="library-game-btn" on:click={() => loadGame(game)} title="Carregar {game.gameName}">
								<span class="game-icon">🎮</span>
								<div class="game-info">
									<span class="game-name">{game.gameName}</span>
									<span class="game-meta">{formatSize(game.fileSize)} · {formatDate(game.lastPlayed)}</span>
								</div>
							</button>
							<button class="btn-remove" on:click={() => requestDelete(game.sha256)} title="Remover da biblioteca">
								✕
							</button>
						{/if}
					</div>

					{#if deletingSha !== game.sha256 && savesPerGame[game.gameName]}
						<div class="save-list">
							{#each savesPerGame[game.gameName] as slot}
								<button class="save-btn" on:click={() => loadSave(slot)} title="Restaurar save: {slot.slotName}">
									<span class="save-icon">💾</span>
									<span class="save-name">{slot.slotName}</span>
									<span class="save-date">{formatDateTime(slot.timestamp)}</span>
								</button>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</div>
{/if}

<style>
	.game-library {
		margin-top: 1.5rem;
		padding: 1.5rem;
		background: var(--bg-elevated);
		border-radius: 8px;
	}

	h4 {
		margin: 0 0 0.75rem 0;
		color: var(--accent);
		font-size: 1rem;
	}

	.library-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.library-item-wrapper {
		display: flex;
		flex-direction: column;
		background: var(--bg-base);
		border: 1px solid var(--border);
		border-radius: 6px;
		transition: border-color 0.2s;
	}

	.library-item-wrapper:hover {
		border-color: var(--accent);
	}

	.library-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.15rem 0.5rem 0.15rem 0;
	}

	.library-item.confirming {
		border-color: var(--error-item-border);
		background: var(--error-item-bg);
		padding: 0.5rem 0.75rem;
		border-radius: 6px;
	}

	.library-game-btn {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		background: none;
		border: none;
		color: var(--text-primary);
		cursor: pointer;
		padding: 0.5rem 0.75rem;
		text-align: left;
		border-radius: 6px;
		transition: background 0.2s;
	}

	.library-game-btn:hover {
		background: var(--btn-hover);
	}

	.game-icon {
		font-size: 1.5rem;
		flex-shrink: 0;
	}

	.game-info {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		min-width: 0;
	}

	.game-name {
		font-weight: 600;
		font-size: 0.95rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.game-meta {
		font-size: 0.78rem;
		color: var(--text-faint);
	}

	/* ---- Save list abaixo do jogo ---- */
	.save-list {
		display: flex;
		flex-direction: column;
		padding: 0 0.5rem 0.4rem 2.75rem;
		gap: 0.15rem;
	}

	.save-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: none;
		border: none;
		color: var(--text-secondary);
		cursor: pointer;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-size: 0.82rem;
		text-align: left;
		transition: background 0.2s, color 0.2s;
	}

	.save-btn:hover {
		background: var(--btn-hover);
		color: var(--text-primary);
	}

	.save-icon {
		font-size: 0.85rem;
		flex-shrink: 0;
	}

	.save-name {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.save-date {
		color: var(--text-faint);
		font-size: 0.75rem;
		flex-shrink: 0;
	}

	/* ---- Botões existentes ---- */
	.btn-remove {
		background: none;
		border: none;
		color: var(--text-faint);
		padding: 0.3rem 0.5rem;
		cursor: pointer;
		font-size: 0.9rem;
		border-radius: 4px;
		transition: background 0.2s, color 0.2s;
		flex-shrink: 0;
	}

	.btn-remove:hover {
		background: var(--error-delete-hover-bg);
		color: var(--error-delete-hover-text);
	}

	.delete-confirm-text {
		color: var(--error-delete-hover-text);
		font-size: 0.88rem;
		font-weight: 600;
	}

	.item-actions {
		display: flex;
		gap: 0.4rem;
		flex-shrink: 0;
	}

	.btn-danger-sm {
		background: var(--error-btn-bg);
		border: 1px solid var(--error-btn-border);
		color: var(--error-btn-text);
		padding: 0.25rem 0.65rem;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.82rem;
		transition: background 0.2s;
	}

	.btn-danger-sm:hover {
		background: var(--error-btn-hover);
	}

	.btn-cancel-sm {
		background: var(--btn-bg);
		border: 1px solid var(--border-light);
		color: var(--text-secondary);
		padding: 0.25rem 0.65rem;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.82rem;
		transition: background 0.2s;
	}

	.btn-cancel-sm:hover {
		background: var(--btn-hover);
	}
</style>
