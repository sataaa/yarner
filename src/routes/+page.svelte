<script lang="ts">
	// Yarner - AI-Assisted Text Adventure Player

	import FileUploader from '$lib/components/FileUploader.svelte';
	import GamePanel from '$lib/components/GamePanel.svelte';
	import AIAssistant from '$lib/components/AIAssistant.svelte';
	import GameLibrary from '$lib/components/GameLibrary.svelte';
	import { gameState, isGameLoaded, currentGameName } from '$lib/stores/gameState';
	import { aiChat } from '$lib/stores/aiChat';
	import {
		clearGameAIData,
		computeSHA256,
		addGameToLibrary,
		updateLastPlayed,
		type GameLibraryEntry
	} from '$lib/stores/aiPersistence';
	import { currentTheme, themes } from '$lib/stores/themeStore';

	let errorMessage = '';
	let gameLibraryRef: GameLibrary;

	async function handleGameLoaded(event: CustomEvent<{ filename: string; data: ArrayBuffer }>) {
		const { filename, data } = event.detail;
		errorMessage = '';

		try {
			// Zera o chat da IA antes de carregar — novo upload = nova jogatina
			const gameName = filename.replace(/\.[^.]+$/, '');
			aiChat.resetAIChat();
			await clearGameAIData(gameName);
			await gameState.loadGame(filename, data);

			// Adiciona à biblioteca de jogos (upsert por SHA-256)
			const sha256 = await computeSHA256(data);
			const now = new Date().toISOString();
			const entry: GameLibraryEntry = {
				sha256,
				filename,
				gameName,
				fileSize: data.byteLength,
				addedDate: now,
				lastPlayed: now,
				gameData: data
			};
			await addGameToLibrary(entry);
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Falha ao carregar o jogo';
			console.error('Error loading game:', error);
		}
	}

	async function handleLoadFromLibrary(event: CustomEvent<{ filename: string; data: ArrayBuffer }>) {
		const { filename, data } = event.detail;
		errorMessage = '';

		try {
			const gameName = filename.replace(/\.[^.]+$/, '');
			aiChat.resetAIChat();
			await clearGameAIData(gameName);
			await gameState.loadGame(filename, data);

			// Atualiza lastPlayed na biblioteca
			const sha256 = await computeSHA256(data);
			await updateLastPlayed(sha256);
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Falha ao carregar o jogo';
			console.error('Error loading game from library:', error);
		}
	}

	function cycleTheme() {
		const idx = themes.findIndex(t => t.id === $currentTheme);
		const next = themes[(idx + 1) % themes.length];
		currentTheme.setTheme(next.id);
	}

	$: activeTheme = themes.find(t => t.id === $currentTheme) ?? themes[0];
</script>

<main>
	<header>
		<span class="logo">🧶 Yarner</span>
		<span class="tagline">Interactive Fiction + IA</span>
		<div class="spacer"></div>
		<button class="theme-btn" on:click={cycleTheme} title="Trocar tema: {activeTheme.label}">
			{activeTheme.icon} {activeTheme.label}
		</button>
	</header>

	{#if errorMessage}
		<div class="error-banner">
			<strong>Erro:</strong> {errorMessage}
			<button on:click={() => errorMessage = ''}>×</button>
		</div>
	{/if}

	{#if !$isGameLoaded}
		<div class="upload-screen">
			<div class="upload-wrapper">
				<GameLibrary bind:this={gameLibraryRef} on:loadFromLibrary={handleLoadFromLibrary} />
				<FileUploader on:gameLoaded={handleGameLoaded} />
			</div>
		</div>
	{:else}
		<div class="container">
			<div class="panel game-panel">
				<GamePanel gameName={$currentGameName} />
			</div>

			<div class="panel ai-panel">
				<AIAssistant />
			</div>
		</div>
	{/if}
</main>

<style>
	main {
		height: 100vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	header {
		background: var(--bg-header);
		padding: 0.45rem 1.5rem;
		border-bottom: 1px solid var(--border);
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-shrink: 0;
	}

	.logo {
		font-size: 1.2rem;
		font-weight: 700;
		color: var(--accent);
		letter-spacing: -0.01em;
	}

	.tagline {
		font-size: 0.75rem;
		color: var(--text-faint);
	}

	.spacer {
		flex: 1;
	}

	.theme-btn {
		background: var(--btn-bg);
		border: 1px solid var(--border);
		color: var(--text-secondary);
		padding: 0.3rem 0.75rem;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.8rem;
		transition: background 0.2s, border-color 0.2s;
		white-space: nowrap;
	}

	.theme-btn:hover {
		background: var(--btn-hover);
		border-color: var(--accent);
		color: var(--accent);
	}

	.error-banner {
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: var(--error-bg);
		color: var(--error-text);
		border-bottom: 1px solid var(--error-border);
		padding: 0.6rem 1.5rem;
		font-size: 0.9rem;
		flex-shrink: 0;
	}

	.error-banner button {
		background: none;
		border: none;
		color: var(--error-text);
		font-size: 1.3rem;
		cursor: pointer;
		padding: 0 0.25rem;
		line-height: 1;
	}

	.upload-screen {
		flex: 1;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		background: var(--bg-base);
		overflow-y: auto;
		padding: 2rem 0;
	}

	.upload-wrapper {
		max-width: 600px;
		width: 100%;
		padding: 0 1rem;
	}

	.container {
		display: flex;
		flex: 1;
		overflow: hidden;
	}

	.panel {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.game-panel {
		background: var(--bg-panel);
		border-right: 1px solid var(--border);
	}

	.ai-panel {
		background: var(--bg-base);
		overflow: hidden;
	}

	@media (max-width: 768px) {
		.container {
			flex-direction: column;
		}

		.game-panel {
			border-right: none;
			border-bottom: 1px solid var(--border);
			min-height: 55vh;
		}
	}
</style>
