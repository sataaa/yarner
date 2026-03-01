<script lang="ts">
	/**
	 * GamePanel - Terminal-style interface for z-machine gameplay.
	 *
	 * Displays game output from the gameState store (single source of truth)
	 * and sends player commands through the store's sendCommand().
	 * Does NOT register its own onOutput callback — the store handles that.
	 */
	import { onMount, onDestroy } from 'svelte';
	import { slide } from 'svelte/transition';
	import { gameState, gameEngine as gameEngineStore } from '$lib/stores/gameState';
	import type { SaveSlot, GameSaveSlots } from '$lib/stores/gameState';
	import { aiChat, aiGameStatus } from '$lib/stores/aiChat';

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
	let saveMessage = '';
	let isSaving = false;
	let isLoadingSlot = false;
	let slotNameInput: HTMLInputElement;

	// ---- Confirmações inline (sem confirm() nativo) ----
	let showRestartConfirm = false;
	let pendingLoadSlot: SaveSlot | null = null;
	let deletingSlotName: string | null = null;

	// Subscribe to the store's gameHistory — single source of truth for output
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
		if (commandInput) commandInput.focus();
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

		gameState.addOutput(`\n> ${command}\n`);
		commandHistory = [...commandHistory, command];
		historyIndex = commandHistory.length;

		try {
			gameState.sendCommand(command);
		} catch (error) {
			gameState.addOutput(`\n[Erro: ${error}]\n`);
		}

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

	// Botão de restart — mostra confirmação inline
	function requestRestart() {
		showRestartConfirm = true;
		showSavePanel = false;
		showLoadPanel = false;
	}

	async function doRestart() {
		showRestartConfirm = false;
		commandHistory = [];
		historyIndex = -1;
		currentCommand = '';
		await gameState.restartGame();
		// Zera status e chat da IA — não são mais relevantes após o restart
		aiChat.resetAIStateForRestart();
	}

	// ---- Save / Load helpers ----

	function showFeedback(msg: string) {
		saveMessage = msg;
		setTimeout(() => { saveMessage = ''; }, 2500);
	}

	async function openLoadPanel() {
		showSavePanel = false;
		showRestartConfirm = false;
		pendingLoadSlot = null;
		deletingSlotName = null;
		saveSlots = await gameState.getSaveSlotList();
		showLoadPanel = true;
	}

	function openSavePanel() {
		showLoadPanel = false;
		showRestartConfirm = false;
		saveSlotName = '';
		showSavePanel = true;
		gameState.getSaveSlotList().then(s => { saveSlots = s; });
		setTimeout(() => { slotNameInput?.focus(); }, 30);
	}

	async function confirmSave() {
		const name = saveSlotName.trim();
		if (!name) return;
		isSaving = true;
		try {
			// Inclui o status atual da IA no slot para restaurar junto com o jogo
			await gameState.saveGame(name, $aiGameStatus);
			showSavePanel = false;
			saveSlotName = '';
			showFeedback(`Salvo: "${name}"`);
		} catch (err) {
			showFeedback(`Erro ao salvar: ${err}`);
		} finally {
			isSaving = false;
		}
	}

	// Clique em "Carregar" — pede confirmação inline
	function requestLoadSlot(slot: SaveSlot) {
		pendingLoadSlot = slot;
		deletingSlotName = null;
	}

	async function doLoadSlot() {
		if (!pendingLoadSlot) return;
		const slot = pendingLoadSlot;
		isLoadingSlot = true;
		showLoadPanel = false;
		pendingLoadSlot = null;
		try {
			await gameState.loadFromSaveSlot(slot);
			commandHistory = [];
			historyIndex = -1;
			currentCommand = '';
			// Restaura o status da IA salvo no slot (localização, inventário, mapa, etc.)
			await aiChat.restoreAIStatusFromSave(slot.aiGameStatus, slot.gameHistory.length);
			showFeedback(`Carregado: "${slot.slotName}"`);
		} catch (err) {
			showFeedback(`Erro ao carregar: ${err}`);
		} finally {
			isLoadingSlot = false;
		}
	}

	// Clique em 🗑 — pede confirmação inline
	function requestDeleteSlot(slotName: string) {
		deletingSlotName = slotName;
		pendingLoadSlot = null;
	}

	async function doDeleteSlot(slotName: string) {
		await gameState.removeSaveSlot(slotName);
		deletingSlotName = null;
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
			<button class="btn-icon" on:click={requestRestart} title="Reiniciar jogo">
				🔄
			</button>
		</div>
	</div>

	{#if saveMessage}
		<div class="save-feedback" transition:slide={{ duration: 150 }}>{saveMessage}</div>
	{/if}

	<!-- Confirmação inline de restart -->
	{#if showRestartConfirm}
		<div class="confirm-strip" transition:slide={{ duration: 150 }}>
			<span>⚠️ Reiniciar o jogo? O progresso atual será perdido.</span>
			<div class="confirm-actions">
				<button class="btn-danger" on:click={doRestart}>Reiniciar</button>
				<button class="btn-cancel-sm" on:click={() => showRestartConfirm = false}>Cancelar</button>
			</div>
		</div>
	{/if}

	<!-- Painel de salvar -->
	{#if showSavePanel}
		<div class="save-load-panel" transition:slide={{ duration: 150 }}>
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

	<!-- Painel de carregar -->
	{#if showLoadPanel}
		<div class="save-load-panel" transition:slide={{ duration: 150 }}>
			<div class="panel-header-row">
				<div class="panel-title">📂 Carregar Jogo</div>
				<button class="btn-cancel" on:click={() => { showLoadPanel = false; pendingLoadSlot = null; deletingSlotName = null; }}>✕</button>
			</div>

			{#if Object.keys(saveSlots).length === 0}
				<div class="no-slots">Nenhum save encontrado para "{gameName}".</div>
			{:else}
				<!-- Confirmação de load inline -->
				{#if pendingLoadSlot}
					<div class="confirm-strip-inline" transition:slide={{ duration: 120 }}>
						<span>Restaurar <strong>"{pendingLoadSlot.slotName}"</strong>? O progresso atual será perdido.</span>
						<div class="confirm-actions">
							<button class="btn-confirm" on:click={doLoadSlot} disabled={isLoadingSlot}>Restaurar</button>
							<button class="btn-cancel-sm" on:click={() => pendingLoadSlot = null}>Cancelar</button>
						</div>
					</div>
				{/if}

				<div class="slot-list">
					{#each Object.values(saveSlots).sort((a, b) => b.timestamp.localeCompare(a.timestamp)) as slot}
						<div class="slot-item" class:confirming={deletingSlotName === slot.slotName}>
							{#if deletingSlotName === slot.slotName}
								<!-- Confirmação de exclusão inline no próprio item -->
								<span class="delete-confirm-text">Deletar "{slot.slotName}"?</span>
								<div class="slot-actions">
									<button class="btn-danger-sm" on:click={() => doDeleteSlot(slot.slotName)}>Deletar</button>
									<button class="btn-cancel-sm" on:click={() => deletingSlotName = null}>Cancelar</button>
								</div>
							{:else}
								<div class="slot-info">
									<span class="slot-name">{slot.slotName}</span>
									<span class="slot-date">{formatTimestamp(slot.timestamp)}</span>
								</div>
								<div class="slot-actions">
									<button
										class="btn-load"
										class:selected={pendingLoadSlot?.slotName === slot.slotName}
										on:click={() => requestLoadSlot(slot)}
										disabled={isLoadingSlot}
									>
										Carregar
									</button>
									<button class="btn-delete" on:click={() => requestDeleteSlot(slot.slotName)} title="Deletar slot">
										🗑
									</button>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<div class="output-container" bind:this={outputContainer}>
		{#if gameOutput.length === 0}
			<div class="welcome-message">
				<p>Jogo carregado! Aguardando output...</p>
				<p class="hint">O jogo começará em instantes.</p>
			</div>
		{:else}
			{#each gameOutput as output}
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
			placeholder="Digite um comando... (↑↓ para histórico)"
			class="command-input"
		/>
	</div>
</div>

<style>
	.game-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--bg-panel);
		overflow: hidden;
	}

	.game-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 1.5rem;
		background: var(--bg-elevated);
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
	}

	.game-title {
		margin: 0;
		font-size: 1rem;
		color: var(--accent);
		font-weight: 600;
	}

	.game-controls {
		display: flex;
		gap: 0.5rem;
	}

	.btn-icon {
		background: var(--btn-bg);
		border: none;
		padding: 0.4rem 0.5rem;
		border-radius: 4px;
		cursor: pointer;
		font-size: 1.1rem;
		transition: background 0.2s;
		line-height: 1;
	}

	.btn-icon:hover:not(:disabled) {
		background: var(--btn-hover);
	}

	.btn-icon:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	/* ---- Feedback de save ---- */
	.save-feedback {
		background: var(--success-bg);
		color: var(--success-text);
		text-align: center;
		padding: 0.35rem 1rem;
		font-size: 0.88rem;
		border-bottom: 1px solid var(--success-border);
		flex-shrink: 0;
	}

	/* ---- Confirmação inline de restart ---- */
	.confirm-strip {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.6rem 1.5rem;
		background: var(--warning-bg);
		border-bottom: 1px solid var(--warning-border);
		font-size: 0.88rem;
		color: var(--warning-text);
		flex-shrink: 0;
		flex-wrap: wrap;
	}

	.confirm-actions {
		display: flex;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.btn-danger {
		background: var(--error-btn-bg);
		border: 1px solid var(--error-btn-border);
		color: var(--error-btn-text);
		padding: 0.3rem 0.85rem;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.85rem;
		transition: background 0.2s;
	}

	.btn-danger:hover {
		background: var(--error-btn-hover);
	}

	.btn-cancel-sm {
		background: var(--btn-bg);
		border: 1px solid var(--border-light);
		color: var(--text-secondary);
		padding: 0.3rem 0.75rem;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.85rem;
		transition: background 0.2s;
	}

	.btn-cancel-sm:hover {
		background: var(--btn-hover);
	}

	/* ---- Save / Load panel ---- */
	.save-load-panel {
		background: var(--bg-elevated);
		border-bottom: 1px solid var(--border);
		padding: 0.75rem 1.5rem;
		flex-shrink: 0;
	}

	.panel-title {
		font-size: 0.88rem;
		color: var(--text-secondary);
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
		background: var(--bg-base);
		border: 1px solid var(--border-light);
		color: var(--text-primary);
		padding: 0.4rem 0.75rem;
		border-radius: 4px;
		font-family: 'Courier New', Courier, monospace;
		font-size: 0.9rem;
	}

	.slot-input:focus {
		outline: none;
		border-color: var(--accent);
	}

	.btn-confirm {
		background: var(--success-bg);
		border: 1px solid var(--success-border);
		color: var(--success-text);
		padding: 0.4rem 1rem;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.88rem;
		transition: background 0.2s;
	}

	.btn-confirm:hover:not(:disabled) {
		background: var(--success-border);
	}

	.btn-confirm:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-cancel {
		background: var(--btn-bg);
		border: none;
		color: var(--text-secondary);
		padding: 0.4rem 0.6rem;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.88rem;
		transition: background 0.2s;
	}

	.btn-cancel:hover {
		background: var(--btn-hover);
	}

	.overwrite-warn {
		margin-top: 0.4rem;
		color: var(--warning-text);
		font-size: 0.82rem;
	}

	.no-slots {
		color: var(--text-faint);
		font-size: 0.88rem;
		padding: 0.25rem 0;
	}

	/* Confirmação inline no painel de load */
	.confirm-strip-inline {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.6rem 0.75rem;
		background: var(--warning-bg);
		border: 1px solid var(--warning-border);
		border-radius: 6px;
		font-size: 0.85rem;
		color: var(--warning-text);
		margin-bottom: 0.5rem;
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
		background: var(--bg-base);
		border: 1px solid var(--border);
		border-radius: 4px;
		padding: 0.4rem 0.75rem;
		transition: border-color 0.2s;
	}

	.slot-item.confirming {
		border-color: var(--error-item-border);
		background: var(--error-item-bg);
	}

	.slot-info {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.slot-name {
		color: var(--text-primary);
		font-size: 0.88rem;
		font-weight: 600;
	}

	.slot-date {
		color: var(--text-faint);
		font-size: 0.76rem;
	}

	.slot-actions {
		display: flex;
		gap: 0.4rem;
		align-items: center;
	}

	.btn-load {
		background: var(--info-bg);
		border: 1px solid var(--info-border);
		color: var(--info-text);
		padding: 0.3rem 0.75rem;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.83rem;
		transition: background 0.2s, border-color 0.2s;
	}

	.btn-load:hover:not(:disabled) {
		background: var(--info-hover);
	}

	.btn-load.selected {
		background: var(--info-selected-bg);
		border-color: var(--info-selected-border);
	}

	.btn-load:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-delete {
		background: none;
		border: none;
		color: var(--text-faint);
		padding: 0.3rem;
		cursor: pointer;
		font-size: 0.9rem;
		border-radius: 4px;
		transition: background 0.2s, color 0.2s;
	}

	.btn-delete:hover {
		background: var(--error-delete-hover-bg);
		color: var(--error-delete-hover-text);
	}

	.delete-confirm-text {
		color: var(--error-delete-hover-text);
		font-size: 0.85rem;
		font-weight: 600;
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

	/* ---- Output area ---- */
	.output-container {
		flex: 1;
		overflow-y: auto;
		padding: 1.5rem;
		font-family: 'Courier New', Courier, monospace;
		font-size: 1rem;
		line-height: 1.6;
		color: var(--text-primary);
		background: var(--bg-panel);
	}

	.output-container::-webkit-scrollbar {
		width: 8px;
	}

	.output-container::-webkit-scrollbar-track {
		background: var(--scrollbar-track);
	}

	.output-container::-webkit-scrollbar-thumb {
		background: var(--scrollbar-thumb);
		border-radius: 4px;
	}

	.output-container::-webkit-scrollbar-thumb:hover {
		background: var(--scrollbar-thumb-hover);
	}

	.output-line {
		white-space: pre-wrap;
		margin-bottom: 0.5rem;
	}

	.output-line.command {
		color: var(--accent);
		font-weight: 600;
	}

	.welcome-message {
		text-align: center;
		padding: 2rem;
		color: var(--text-faint);
	}

	.welcome-message p {
		margin: 0.5rem 0;
	}

	.hint {
		color: var(--text-faint);
		font-size: 0.9rem;
		font-style: italic;
	}

	/* ---- Input area ---- */
	.input-container {
		display: flex;
		align-items: center;
		padding: 0.75rem 1.5rem;
		background: var(--bg-elevated);
		border-top: 1px solid var(--border);
		flex-shrink: 0;
	}

	.prompt {
		color: var(--accent);
		font-family: 'Courier New', Courier, monospace;
		font-size: 1.2rem;
		font-weight: 700;
		margin-right: 0.75rem;
	}

	.command-input {
		flex: 1;
		background: var(--bg-input);
		border: 1px solid var(--border-light);
		padding: 0.65rem 1rem;
		font-family: 'Courier New', Courier, monospace;
		font-size: 1rem;
		color: var(--text-primary);
		border-radius: 4px;
		transition: border-color 0.2s;
	}

	.command-input:focus {
		outline: none;
		border-color: var(--accent);
	}

	.command-input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
