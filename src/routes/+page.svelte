<script lang="ts">
	// Yarner - AI-Assisted Text Adventure Player
	// MVP v0.1.0
</script>

<main>
	<header>
		<h1>🧶 Yarner</h1>
		<p>AI-Assisted Text Adventure Player</p>
	</header>

	<div class="container">
		<div class="panel game-panel">
			<h2>Text Adventure</h2>
			<p>Upload a .z5 or .z8 game file to start</p>
			<!-- GamePanel component will go here -->
		</div>

		<div class="panel ai-panel">
			<h2>AI Assistant</h2>
			<p>Your AI companion will appear here</p>
			<!-- AIAssistant component will go here -->
		</div>
	</div>
</main>

<style>
	main {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
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

	.container {
		display: flex;
		flex: 1;
		gap: 0;
	}

	.panel {
		flex: 1;
		padding: 2rem;
		overflow: auto;
	}

	.game-panel {
		background: #1e1e1e;
		border-right: 2px solid #3a3a3a;
	}

	.ai-panel {
		background: #1a1a1a;
	}

	h2 {
		margin-top: 0;
		color: #ffa500;
		font-size: 1.5rem;
	}

	@media (max-width: 768px) {
		.container {
			flex-direction: column;
		}

		.game-panel {
			border-right: none;
			border-bottom: 2px solid #3a3a3a;
		}
	}
</style>
