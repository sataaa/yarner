<script lang="ts">
	// Yarner - AI-Assisted Text Adventure Player

	import FileUploader from '$lib/components/FileUploader.svelte';
	import GamePanel from '$lib/components/GamePanel.svelte';
	import AIAssistant from '$lib/components/AIAssistant.svelte';
	import LocationMap from '$lib/components/LocationMap.svelte';
	import { gameState, isGameLoaded, currentGameName } from '$lib/stores/gameState';
	import { locationMapExpanded } from '$lib/stores/aiChat';

	let errorMessage = '';

	async function handleGameLoaded(event: CustomEvent<{ filename: string; data: ArrayBuffer }>) {
		const { filename, data } = event.detail;
		errorMessage = '';

		try {
			await gameState.loadGame(filename, data);
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Falha ao carregar o jogo';
			console.error('Error loading game:', error);
		}
	}
</script>

<main>
	<header>
		<span class="logo">🧶 Yarner</span>
		<span class="tagline">Interactive Fiction + IA</span>
	</header>

	{#if errorMessage}
		<div class="error-banner">
			<strong>Erro:</strong> {errorMessage}
			<button on:click={() => errorMessage = ''}>×</button>
		</div>
	{/if}

	{#if !$isGameLoaded}
		<div class="upload-screen">
			<FileUploader on:gameLoaded={handleGameLoaded} />
		</div>
	{:else}
		<div class="container">
			<div class="panel game-panel">
				<GamePanel gameName={$currentGameName} />
			</div>

			<div class="panel ai-panel">
				<AIAssistant />
			</div>

			{#if $locationMapExpanded}
				<div class="panel map-panel">
					<LocationMap expanded={true} />
				</div>
			{/if}
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
		background: #242424;
		padding: 0.45rem 1.5rem;
		border-bottom: 1px solid #3a3a3a;
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-shrink: 0;
	}

	.logo {
		font-size: 1.2rem;
		font-weight: 700;
		color: #ffa500;
		letter-spacing: -0.01em;
	}

	.tagline {
		font-size: 0.75rem;
		color: #555;
	}

	.error-banner {
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: #331818;
		color: #ff8888;
		border-bottom: 1px solid #552222;
		padding: 0.6rem 1.5rem;
		font-size: 0.9rem;
		flex-shrink: 0;
	}

	.error-banner button {
		background: none;
		border: none;
		color: #ff8888;
		font-size: 1.3rem;
		cursor: pointer;
		padding: 0 0.25rem;
		line-height: 1;
	}

	.upload-screen {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #1a1a1a;
		overflow-y: auto;
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
		background: #1e1e1e;
		border-right: 1px solid #3a3a3a;
	}

	.ai-panel {
		background: #1a1a1a;
		overflow: hidden;
	}

	.map-panel {
		background: #1e1e1e;
		border-left: 1px solid #3a3a3a;
		flex: 0 0 300px;
		overflow: hidden;
	}

	@media (max-width: 768px) {
		.container {
			flex-direction: column;
		}

		.game-panel {
			border-right: none;
			border-bottom: 1px solid #3a3a3a;
			min-height: 55vh;
		}

		.map-panel {
			flex: 0 0 200px;
			border-left: none;
			border-top: 1px solid #3a3a3a;
		}
	}
</style>
