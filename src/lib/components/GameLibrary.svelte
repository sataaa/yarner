<script lang="ts">
	import { onMount } from 'svelte';
	import { slide } from 'svelte/transition';
	import { createEventDispatcher } from 'svelte';
	import {
		getGameLibrary,
		removeGameFromLibrary,
		type GameLibraryEntry
	} from '$lib/stores/aiPersistence';

	const dispatch = createEventDispatcher<{
		loadFromLibrary: { filename: string; data: ArrayBuffer };
	}>();

	let games: GameLibraryEntry[] = [];
	let deletingSha: string | null = null;

	onMount(async () => {
		games = await getGameLibrary();
	});

	/** Recarregar a lista (chamado pelo parent após adicionar jogo à biblioteca) */
	export async function refresh() {
		games = await getGameLibrary();
	}

	function loadGame(entry: GameLibraryEntry) {
		dispatch('loadFromLibrary', {
			filename: entry.filename,
			data: entry.gameData
		});
	}

	function requestDelete(sha256: string) {
		deletingSha = sha256;
	}

	async function doDelete(sha256: string) {
		await removeGameFromLibrary(sha256);
		deletingSha = null;
		games = await getGameLibrary();
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
</script>

{#if games.length > 0}
	<div class="game-library">
		<h4>Jogos Recentes</h4>
		<div class="library-list">
			{#each games as game (game.sha256)}
				<div class="library-item" class:confirming={deletingSha === game.sha256} transition:slide={{ duration: 150 }}>
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
		gap: 0.4rem;
	}

	.library-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: var(--bg-base);
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 0.15rem 0.5rem 0.15rem 0;
		transition: border-color 0.2s;
	}

	.library-item:hover:not(.confirming) {
		border-color: var(--accent);
	}

	.library-item.confirming {
		border-color: var(--error-item-border);
		background: var(--error-item-bg);
		padding: 0.5rem 0.75rem;
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
