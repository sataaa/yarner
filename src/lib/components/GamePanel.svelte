<script lang="ts">
	/**
	 * GamePanel - Terminal-style interface for z-machine gameplay.
	 *
	 * Displays game output from the gameState store (single source of truth)
	 * and sends player commands through the store's sendCommand().
	 * Does NOT register its own onOutput callback — the store handles that.
	 */
	import { onMount, onDestroy } from 'svelte';
	import { gameState, gameEngine as gameEngineStore } from '$lib/stores/gameState';
	import type { SaveSlot, GameSaveSlots } from '$lib/stores/gameState';

	export let gameName: string = '';

	let outputContainer: HTMLDivElement;
	let commandInput: HTMLInputElement;
	let commandHistory: string[] = [];
	let historyIndex: number = -1;
	let currentCommand: string = '';

	// ---- Save / Load UI state ----
	let showSavePanel = false;
	let showLoadPanel = false;
	let saveSlotName = '';
	let saveSlots: GameSaveSlots = {};
	let saveMessage = '';   // feedback shown briefly after save/load
	let isSaving = false;
	let isLoadingSlot = false;
	let slotNameInput: HTMLInputElement;

	// Subscribe to the store's gameHistory — the single source of truth for output
	let gameOutput: string[] = [];
	const unsubscribe = gameState.subscribe(state => {
		gameOutput = state.gameHistory;
	});

	// Auto-scroll to bottom when new output arrives
	$: if (gameOutput.length > 0 && outputContainer) {
		setTimeout(() => {
			if (outputContainer) outputContainer.scrollTop = outputContainer.scrollHeight;
		}, 10);
	}

	onMount(() => {
		// Focus the command input when the panel mounts
		if (commandInput) {
			commandInput.focus();
		}
	});

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
		if (!command) return;

		// Add player command echo to store history (so it shows in output)
		gameState.addOutput(`\n> ${command}\n`);

		// Add to local command history for arrow-key navigation
		commandHistory = [...commandHistory, command];
		historyIndex = commandHistory.length;

		// Send to game engine via store
		try {
			gameState.sendCommand(command);
		} catch (error) {
			gameState.addOutput(`\n[Error: ${error}]\n`);
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
		gameState.clearHistory();
	}

	function restartGame() {
		if (confirm('Are you sure you want to restart the game? Progress will be lost.')) {
			commandHistory = [];
			historyIndex = -1;
			currentCommand = '';
			gameState.restartGame();
		}
	}

	// ---- Save / Load helpers ----

	function showFeedback(msg: string) {
		saveMessage = msg;
		setTimeout(() => { saveMessage = ''; }, 2500);
	}

	async function openLoadPanel() {
		showSavePanel = false;
		saveSlots = await gameState.getSaveSlotList();
		showLoadPanel = true;
	}

	function openSavePanel() {
		showLoadPanel = false;
		saveSlotName = '';
		showSavePanel = true;
		// Refresh slot list so "overwrite" warning works
		gameState.getSaveSlotList().then(s => { saveSlots = s; });
		// Focus input on next tick (after Svelte renders the panel)
		setTimeout(() => { slotNameInput?.focus(); }, 30);
	}

	async function confirmSave() {
		const name = saveSlotName.trim();
		if (!name) return;
		isSaving = true;
		try {
			await gameState.saveGame(name);
			showSavePanel = false;
			saveSlotName = '';
			showFeedback(`Salvo: "${name}"`);
		} catch (err) {
			showFeedback(`Erro ao salvar: ${err}`);
		} finally {
			isSaving = false;
		}
	}

	async function loadSlot(slot: SaveSlot) {
		if (!confirm(`Restaurar "${slot.slotName}"? O progresso atual será perdido.`)) return;
		isLoadingSlot = true;
		showLoadPanel = false;
		try {
			await gameState.loadFromSaveSlot(slot);
			commandHistory = [];
			historyIndex = -1;
			currentCommand = '';
			showFeedback(`Carregado: "${slot.slotName}"`);
		} catch (err) {
			showFeedback(`Erro ao carregar: ${err}`);
		} finally {
			isLoadingSlot = false;
		}
	}

	async function deleteSlot(slotName: string) {
		if (!confirm(`Deletar slot "${slotName}"?`)) return;
		await gameState.removeSaveSlot(slotName);
		saveSlots = await gameState.getSaveSlotList();
	}

	function formatTimestamp(iso: string): string {
		try {
			return new Date(iso).toLocaleString('pt-BR');
		} catch {
			return iso;
		}
	}

	onDestroy(() => {
		unsubscribe();
	});
</script>

<div class="game-panel">
	<div class="game-header">
		<h2 class="game-title">{gameName || 'Interactive Fiction'}</h2>
		<div class="game-controls">
			<button class="btn-icon" on:click={openSavePanel} title="Salvar jogo" disabled={isLoadingSlot}>
				💾
			</button>
			<button class="btn-icon" on:click={openLoadPanel} title="Carregar jogo" disabled={isLoadingSlot}>
				📂
			</button>
			<button class="btn-icon" on:click={clearOutput} title="Limpar output">
				🗑️
			</button>
			<button class="btn-icon" on:click={restartGame} title="Reiniciar jogo">
				🔄
			</button>
		</div>
	</div>

	{#if saveMessage}
		<div class="save-feedback">{saveMessage}</div>
	{/if}

	{#if showSavePanel}
		<div class="save-load-panel">
			<div class="panel-title">💾 Salvar Jogo</div>
			<div class="panel-row">
				<input
					class="slot-input"
					type="text"
					placeholder="Nome do slot..."
					bind:value={saveSlotName}
					bind:this={slotNameInput}
					on:keydown={(e) => e.key === 'Enter' && confirmSave()}
					maxlength="40"
				/>
				<button class="btn-confirm" on:click={confirmSave} disabled={!saveSlotName.trim() || isSaving}>
					{isSaving ? '...' : 'Salvar'}
				</button>
				<button class="btn-cancel" on:click={() => { showSavePanel = false; }}>✕</button>
			</div>
			{#if saveSlots[saveSlotName.trim()]}
				<div class="overwrite-warn">⚠️ Este slot já existe e será sobrescrito.</div>
			{/if}
		</div>
	{/if}

	{#if showLoadPanel}
		<div class="save-load-panel">
			<div class="panel-header-row">
				<div class="panel-title">📂 Carregar Jogo</div>
				<button class="btn-cancel" on:click={() => { showLoadPanel = false; }}>✕</button>
			</div>
			{#if Object.keys(saveSlots).length === 0}
				<div class="no-slots">Nenhum save encontrado para "{gameName}".</div>
			{:else}
				<div class="slot-list">
					{#each Object.values(saveSlots).sort((a, b) => b.timestamp.localeCompare(a.timestamp)) as slot}
						<div class="slot-item">
							<div class="slot-info">
								<span class="slot-name">{slot.slotName}</span>
								<span class="slot-date">{formatTimestamp(slot.timestamp)}</span>
							</div>
							<div class="slot-actions">
								<button class="btn-load" on:click={() => loadSlot(slot)} disabled={isLoadingSlot}>
									Carregar
								</button>
								<button class="btn-delete" on:click={() => deleteSlot(slot.slotName)} title="Deletar slot">
									🗑
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

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
			placeholder="Enter command..."
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

	/* ---- Save / Load UI ---- */

	.save-feedback {
		background: #2a3a2a;
		color: #90d090;
		text-align: center;
		padding: 0.4rem 1rem;
		font-size: 0.9rem;
		border-bottom: 1px solid #3a5a3a;
	}

	.save-load-panel {
		background: #222;
		border-bottom: 1px solid #3a3a3a;
		padding: 0.75rem 1.5rem;
	}

	.panel-title {
		font-size: 0.9rem;
		color: #aaa;
		margin-bottom: 0.5rem;
		font-weight: 600;
	}

	.panel-header-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}

	.panel-row {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.slot-input {
		flex: 1;
		background: #1a1a1a;
		border: 1px solid #4a4a4a;
		color: #e0e0e0;
		padding: 0.4rem 0.75rem;
		border-radius: 4px;
		font-family: 'Courier New', Courier, monospace;
		font-size: 0.9rem;
	}

	.slot-input:focus {
		outline: none;
		border-color: #ffa500;
	}

	.btn-confirm {
		background: #2a4a2a;
		border: 1px solid #4a7a4a;
		color: #90d090;
		padding: 0.4rem 1rem;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.9rem;
	}

	.btn-confirm:hover:not(:disabled) {
		background: #3a6a3a;
	}

	.btn-confirm:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-cancel {
		background: #3a3a3a;
		border: none;
		color: #aaa;
		padding: 0.4rem 0.6rem;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.9rem;
	}

	.btn-cancel:hover {
		background: #4a4a4a;
	}

	.overwrite-warn {
		margin-top: 0.4rem;
		color: #e0a050;
		font-size: 0.82rem;
	}

	.no-slots {
		color: #888;
		font-size: 0.9rem;
		padding: 0.25rem 0;
	}

	.slot-list {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		max-height: 180px;
		overflow-y: auto;
	}

	.slot-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: #1a1a1a;
		border: 1px solid #3a3a3a;
		border-radius: 4px;
		padding: 0.4rem 0.75rem;
	}

	.slot-info {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.slot-name {
		color: #e0e0e0;
		font-size: 0.9rem;
		font-weight: 600;
	}

	.slot-date {
		color: #888;
		font-size: 0.78rem;
	}

	.slot-actions {
		display: flex;
		gap: 0.4rem;
		align-items: center;
	}

	.btn-load {
		background: #2a3a5a;
		border: 1px solid #4a5a8a;
		color: #90aaff;
		padding: 0.3rem 0.75rem;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.85rem;
	}

	.btn-load:hover:not(:disabled) {
		background: #3a4a7a;
	}

	.btn-load:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-delete {
		background: none;
		border: none;
		color: #888;
		padding: 0.3rem;
		cursor: pointer;
		font-size: 0.9rem;
		border-radius: 4px;
	}

	.btn-delete:hover {
		background: #3a2a2a;
		color: #e08080;
	}
</style>
