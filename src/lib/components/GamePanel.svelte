<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { GameEngine } from '$lib/zmachine/zvm-wrapper';

	export let gameEngine: GameEngine | null = null;
	export let gameName: string = '';

	let outputContainer: HTMLDivElement;
	let commandInput: HTMLInputElement;
	let gameOutput: string[] = [];
	let commandHistory: string[] = [];
	let historyIndex: number = -1;
	let currentCommand: string = '';
	let isWaitingForInput: boolean = false;

	// Auto-scroll to bottom when new output arrives
	$: if (gameOutput.length > 0 && outputContainer) {
		setTimeout(() => {
			outputContainer.scrollTop = outputContainer.scrollHeight;
		}, 10);
	}

	onMount(() => {
		if (gameEngine) {
			setupGameEngine();
		}
	});

	function setupGameEngine() {
		if (!gameEngine) return;

		// Register output callback
		gameEngine.onOutput((text: string) => {
			if (text.trim()) {
				gameOutput = [...gameOutput, text];
			}
		});

		// Focus input field
		if (commandInput) {
			commandInput.focus();
		}

		isWaitingForInput = true;
	}

	function handleCommand(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			sendCommand();
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			navigateHistory('up');
		} else if (event.key === 'ArrowDown') {
			event.preventDefault();
			navigateHistory('down');
		}
	}

	function sendCommand() {
		const command = currentCommand.trim();

		if (!command || !gameEngine || !isWaitingForInput) {
			return;
		}

		// Add command to output
		gameOutput = [...gameOutput, `\n> ${command}\n`];

		// Add to command history
		commandHistory = [...commandHistory, command];
		historyIndex = commandHistory.length;

		// Send to game engine
		try {
			gameEngine.sendCommand(command);
			isWaitingForInput = true;
		} catch (error) {
			gameOutput = [...gameOutput, `\n[Error: ${error}]\n`];
		}

		// Clear input
		currentCommand = '';
	}

	function navigateHistory(direction: 'up' | 'down') {
		if (commandHistory.length === 0) return;

		if (direction === 'up') {
			if (historyIndex > 0) {
				historyIndex--;
				currentCommand = commandHistory[historyIndex];
			}
		} else {
			if (historyIndex < commandHistory.length - 1) {
				historyIndex++;
				currentCommand = commandHistory[historyIndex];
			} else {
				historyIndex = commandHistory.length;
				currentCommand = '';
			}
		}
	}

	function clearOutput() {
		gameOutput = [];
	}

	function restartGame() {
		if (gameEngine && confirm('Are you sure you want to restart the game? Progress will be lost.')) {
			gameOutput = [];
			commandHistory = [];
			historyIndex = -1;
			currentCommand = '';
			gameEngine.restart();
			isWaitingForInput = true;
		}
	}

	onDestroy(() => {
		// Clean up
		if (gameEngine) {
			gameEngine.destroy();
		}
	});
</script>

<div class="game-panel">
	<div class="game-header">
		<h2 class="game-title">{gameName || 'Interactive Fiction'}</h2>
		<div class="game-controls">
			<button class="btn-icon" on:click={clearOutput} title="Clear output">
				🗑️
			</button>
			<button class="btn-icon" on:click={restartGame} title="Restart game">
				🔄
			</button>
		</div>
	</div>

	<div class="output-container" bind:this={outputContainer}>
		{#if gameOutput.length === 0}
			<div class="welcome-message">
				<p>Game loaded! Waiting for initial output...</p>
				<p class="hint">The game will start shortly.</p>
			</div>
		{:else}
			{#each gameOutput as output, i}
				<div class="output-line" class:command={output.startsWith('>')}>
					{output}
				</div>
			{/each}
		{/if}
	</div>

	<div class="input-container">
		<span class="prompt">&gt;</span>
		<input
			type="text"
			bind:value={currentCommand}
			bind:this={commandInput}
			on:keydown={handleCommand}
			placeholder={isWaitingForInput ? 'Enter command...' : 'Waiting...'}
			disabled={!isWaitingForInput}
			class="command-input"
		/>
	</div>

	<div class="hints">
		<span class="hint-item">↑↓ History</span>
		<span class="hint-item">Enter to send</span>
		<span class="hint-item">Try: "look", "inventory", "help"</span>
	</div>
</div>

<style>
	.game-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: #1e1e1e;
		border-radius: 8px;
		overflow: hidden;
	}

	.game-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 1.5rem;
		background: #2a2a2a;
		border-bottom: 1px solid #3a3a3a;
	}

	.game-title {
		margin: 0;
		font-size: 1.2rem;
		color: #ffa500;
	}

	.game-controls {
		display: flex;
		gap: 0.5rem;
	}

	.btn-icon {
		background: #3a3a3a;
		border: none;
		padding: 0.5rem;
		border-radius: 4px;
		cursor: pointer;
		font-size: 1.2rem;
		transition: background 0.3s;
	}

	.btn-icon:hover {
		background: #4a4a4a;
	}

	.output-container {
		flex: 1;
		overflow-y: auto;
		padding: 1.5rem;
		font-family: 'Courier New', Courier, monospace;
		font-size: 1rem;
		line-height: 1.6;
		color: #e0e0e0;
		background: #1e1e1e;
	}

	.output-container::-webkit-scrollbar {
		width: 8px;
	}

	.output-container::-webkit-scrollbar-track {
		background: #2a2a2a;
	}

	.output-container::-webkit-scrollbar-thumb {
		background: #4a4a4a;
		border-radius: 4px;
	}

	.output-container::-webkit-scrollbar-thumb:hover {
		background: #5a5a5a;
	}

	.output-line {
		white-space: pre-wrap;
		margin-bottom: 0.5rem;
	}

	.output-line.command {
		color: #ffa500;
		font-weight: 600;
	}

	.welcome-message {
		text-align: center;
		padding: 2rem;
		color: #888;
	}

	.welcome-message p {
		margin: 0.5rem 0;
	}

	.input-container {
		display: flex;
		align-items: center;
		padding: 1rem 1.5rem;
		background: #2a2a2a;
		border-top: 1px solid #3a3a3a;
	}

	.prompt {
		color: #ffa500;
		font-family: 'Courier New', Courier, monospace;
		font-size: 1.2rem;
		font-weight: 700;
		margin-right: 0.75rem;
	}

	.command-input {
		flex: 1;
		background: #1e1e1e;
		border: 1px solid #4a4a4a;
		padding: 0.75rem 1rem;
		font-family: 'Courier New', Courier, monospace;
		font-size: 1rem;
		color: #e0e0e0;
		border-radius: 4px;
		transition: border-color 0.3s;
	}

	.command-input:focus {
		outline: none;
		border-color: #ffa500;
	}

	.command-input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.hints {
		display: flex;
		justify-content: center;
		gap: 2rem;
		padding: 0.75rem;
		background: #2a2a2a;
		border-top: 1px solid #3a3a3a;
		font-size: 0.85rem;
	}

	.hint-item {
		color: #888;
	}

	.hint {
		color: #888;
		font-size: 0.9rem;
		font-style: italic;
	}
</style>
