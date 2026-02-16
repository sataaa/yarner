<script lang="ts">
	// Yarner - AI-Assisted Text Adventure Player
	// MVP v0.1.0

	import FileUploader from '$lib/components/FileUploader.svelte';
	import GamePanel from '$lib/components/GamePanel.svelte';
	import { gameState, isGameLoaded, currentGameName } from '$lib/stores/gameState';

	let errorMessage = '';

	async function handleGameLoaded(event: CustomEvent<{ filename: string; data: ArrayBuffer }>) {
		const { filename, data } = event.detail;
		errorMessage = '';

		try {
			await gameState.loadGame(filename, data);
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to load game';
			console.error('Error loading game:', error);
		}
	}
</script>

<main>
	<header>
		<h1>🧶 Yarner</h1>
		<p>AI-Assisted Text Adventure Player</p>
	</header>

	{#if errorMessage}
		<div class="error-banner">
			<strong>Error:</strong> {errorMessage}
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
				<div class="ai-placeholder">
					<h2>🤖 AI Assistant</h2>
					<p>Coming soon! The AI assistant will help you navigate the game.</p>
					<div class="features">
						<h3>Features (In Development):</h3>
						<ul>
							<li>💬 Chat about the game in real-time</li>
							<li>🗺️ Track items and locations</li>
							<li>💡 Get hints when you're stuck</li>
							<li>🔍 Suggest unexplored areas</li>
						</ul>
					</div>
				</div>
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
		background: #2a2a2a;
		padding: 1.5rem 2rem;
		border-bottom: 2px solid #3a3a3a;
		text-align: center;
	}

	h1 {
		margin: 0;
		font-size: 2.5rem;
		color: #ffa500;
	}

	header p {
		margin: 0.5rem 0 0;
		color: #b0b0b0;
	}

	.error-banner {
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: #ff4444;
		color: white;
		padding: 1rem 2rem;
		font-size: 1rem;
	}

	.error-banner button {
		background: none;
		border: none;
		color: white;
		font-size: 1.5rem;
		cursor: pointer;
		padding: 0 0.5rem;
	}

	.upload-screen {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #1a1a1a;
	}

	.container {
		display: flex;
		flex: 1;
		gap: 0;
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
		border-right: 2px solid #3a3a3a;
	}

	.ai-panel {
		background: #1a1a1a;
		padding: 2rem;
		overflow-y: auto;
	}

	.ai-placeholder {
		max-width: 500px;
		margin: 0 auto;
	}

	.ai-placeholder h2 {
		color: #ffa500;
		font-size: 1.8rem;
		margin-bottom: 1rem;
	}

	.ai-placeholder p {
		color: #b0b0b0;
		font-size: 1.1rem;
		margin-bottom: 2rem;
	}

	.features {
		background: #2a2a2a;
		padding: 1.5rem;
		border-radius: 8px;
		margin-top: 2rem;
	}

	.features h3 {
		color: #ffa500;
		margin-top: 0;
		margin-bottom: 1rem;
	}

	.features ul {
		list-style: none;
		padding: 0;
	}

	.features li {
		padding: 0.75rem 0;
		color: #e0e0e0;
		border-bottom: 1px solid #3a3a3a;
	}

	.features li:last-child {
		border-bottom: none;
	}

	@media (max-width: 768px) {
		.container {
			flex-direction: column;
		}

		.game-panel {
			border-right: none;
			border-bottom: 2px solid #3a3a3a;
			min-height: 60vh;
		}
	}
</style>
