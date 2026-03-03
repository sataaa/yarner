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
	import { get } from 'svelte/store';
	import { t, locale } from 'svelte-i18n';
	import { gameState, gameEngine as gameEngineStore } from '$lib/stores/gameState';
	import type { SaveSlot, GameSaveSlots } from '$lib/stores/gameState';
	import { aiChat, aiMemory, aiMessages } from '$lib/stores/aiChat';
	import FloppyDisk from 'phosphor-svelte/lib/FloppyDisk';
	import FolderOpen from 'phosphor-svelte/lib/FolderOpen';
	import Trash from 'phosphor-svelte/lib/Trash';
	import ArrowCounterClockwise from 'phosphor-svelte/lib/ArrowCounterClockwise';
	import X from 'phosphor-svelte/lib/X';
	import Warning from 'phosphor-svelte/lib/Warning';

	export let gameName: string = '';
	export let displayName: string = '';
	export let lastSlotName: string = '';

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

	// ---- Click-to-focus: clicking anywhere in game output focuses the input ----
	let focusFromClick = false;

	function focusCommandInput() {
		focusFromClick = true;
		commandInput?.focus();
		setTimeout(() => { focusFromClick = false; }, 300);
	}

	// ---- Inline confirmations (no native confirm()) ----
	let showRestartConfirm = false;
	let showCloseConfirm = false;
	let pendingLoadSlot: SaveSlot | null = null;
	let deletingSlotName: string | null = null;
	let showOverwriteConfirm = false;

	// Subscribe to the store's gameHistory — single source of truth for output
	let gameOutput: string[] = [];
	let prevOutputLength = 0;
	const unsubscribe = gameState.subscribe(state => {
		// Reset tracker when history is cleared (restart, new game)
		if (state.gameHistory.length < prevOutputLength) {
			prevOutputLength = 0;
			typingIndex = -1;
		}
		gameOutput = state.gameHistory;
	});

	// ---- Typewriter effect for new game output ----
	// When new entries appear in gameOutput, the last entry is revealed
	// gradually via requestAnimationFrame for a terminal feel.
	const GAME_CHARS_PER_FRAME = 4;
	/** Index of the entry currently being typewritten (-1 = none) */
	let typingIndex = -1;
	/** How many characters of that entry are visible so far */
	let typingCharsShown = 0;
	let typewriterRaf = 0;

	$: if (gameOutput.length > prevOutputLength && gameOutput.length > 0) {
		const wasAtBottom = outputContainer
			? outputContainer.scrollHeight - outputContainer.scrollTop - outputContainer.clientHeight < 60
			: true;
		prevOutputLength = gameOutput.length;

		// Find the last new entry that isn't a command echo — typewrite it
		const lastIdx = gameOutput.length - 1;
		const lastEntry = gameOutput[lastIdx];
		const isCommand = lastEntry.startsWith('>') || lastEntry.startsWith('\n>');

		if (!isCommand && lastEntry.length > 0) {
			typingIndex = lastIdx;
			typingCharsShown = 0;
			startGameTypewriter(wasAtBottom);
		} else {
			typingIndex = -1;
			if (wasAtBottom) {
				setTimeout(() => {
					if (outputContainer) outputContainer.scrollTop = outputContainer.scrollHeight;
				}, 10);
			}
		}
	}

	function startGameTypewriter(autoScroll: boolean) {
		if (typewriterRaf) cancelAnimationFrame(typewriterRaf);
		typewriterRaf = requestAnimationFrame(() => gameTypewriterTick(autoScroll));
	}

	function gameTypewriterTick(autoScroll: boolean) {
		if (typingIndex < 0 || typingIndex >= gameOutput.length) {
			typewriterRaf = 0;
			return;
		}
		const full = gameOutput[typingIndex];
		if (typingCharsShown < full.length) {
			typingCharsShown += GAME_CHARS_PER_FRAME;
			typingCharsShown = typingCharsShown;
			typewriterRaf = requestAnimationFrame(() => {
				// Scroll after Svelte re-renders (next frame) so the new content is measured
				if (autoScroll && outputContainer) {
					outputContainer.scrollTop = outputContainer.scrollHeight;
				}
				gameTypewriterTick(autoScroll);
			});
		} else {
			typingIndex = -1;
			typewriterRaf = 0;
			if (autoScroll && outputContainer) {
				outputContainer.scrollTop = outputContainer.scrollHeight;
			}
		}
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
			gameState.addOutput(`\n${get(t)('game.errorOutput', { values: { error: String(error) } })}\n`);
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

	// Close game button — shows inline confirmation
	function requestCloseGame() {
		showCloseConfirm = true;
		showRestartConfirm = false;
		showSavePanel = false;
		showLoadPanel = false;
	}

	function doCloseGame() {
		showCloseConfirm = false;
		aiChat.resetAIChat();
		gameState.unloadGame();
	}

	// Restart button — shows inline confirmation
	function requestRestart() {
		showRestartConfirm = true;
		showCloseConfirm = false;
		showSavePanel = false;
		showLoadPanel = false;
	}

	async function doRestart() {
		showRestartConfirm = false;
		commandHistory = [];
		historyIndex = -1;
		currentCommand = '';
		// Reset AI status and chat BEFORE restart — avoids race condition
		// with the reactive loadAIStateForGame that triggers when isLoaded becomes true
		await aiChat.resetAIStateForRestart();
		await gameState.restartGame();
	}

	// ---- Save / Load helpers ----

	function showFeedback(msg: string) {
		saveMessage = msg;
		setTimeout(() => { saveMessage = ''; }, 2500);
	}

	async function openLoadPanel() {
		if (showLoadPanel) { showLoadPanel = false; return; }
		showSavePanel = false;
		showRestartConfirm = false;
		pendingLoadSlot = null;
		deletingSlotName = null;
		saveSlots = await gameState.getSaveSlotList();
		showLoadPanel = true;
	}

	function openSavePanel() {
		if (showSavePanel) { showSavePanel = false; return; }
		showLoadPanel = false;
		showRestartConfirm = false;
		saveSlotName = '';
		showOverwriteConfirm = false;
		showSavePanel = true;
		gameState.getSaveSlotList().then(s => { saveSlots = s; });
		setTimeout(() => { slotNameInput?.focus(); }, 30);
	}

	async function confirmSave() {
		const name = saveSlotName.trim();
		if (!name) return;
		isSaving = true;
		try {
			// Include AI status and chat in the slot to restore alongside the game
			await gameState.saveGame(name, $aiMemory, $aiMessages);
			lastSlotName = name;
			showSavePanel = false;
			saveSlotName = '';
			showFeedback(get(t)('game.save.saved', { values: { name } }));
		} catch (err) {
			showFeedback(get(t)('game.save.saveError', { values: { error: String(err) } }));
		} finally {
			isSaving = false;
		}
	}

	/** Overwrites the last loaded slot with the current state */
	async function confirmOverwrite() {
		if (!lastSlotName) return;
		isSaving = true;
		showOverwriteConfirm = false;
		try {
			await gameState.saveGame(lastSlotName, $aiMemory, $aiMessages);
			showSavePanel = false;
			saveSlotName = '';
			showFeedback(get(t)('game.save.saved', { values: { name: lastSlotName } }));
		} catch (err) {
			showFeedback(get(t)('game.save.saveError', { values: { error: String(err) } }));
		} finally {
			isSaving = false;
		}
	}

	// Click on "Load" — asks for inline confirmation
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
			// Persist the AI state from the slot into IndexedDB BEFORE loading the game.
			// This avoids a race condition: loadFromSaveSlot sets isLoaded=true which
			// triggers the reactive loadAIStateForGame — which now finds the correct data.
			await aiChat.restoreAIMemoryFromSave(slot.aiMemory, slot.gameHistory.length, slot.aiChatMessages);
			await gameState.loadFromSaveSlot(slot);
			lastSlotName = slot.slotName;
			commandHistory = [];
			historyIndex = -1;
			currentCommand = '';
			showFeedback(get(t)('game.load.loaded', { values: { name: slot.slotName } }));
		} catch (err) {
			showFeedback(get(t)('game.load.loadError', { values: { error: String(err) } }));
		} finally {
			isLoadingSlot = false;
		}
	}

	// Click on 🗑 — asks for inline confirmation
	function requestDeleteSlot(slotName: string) {
		deletingSlotName = slotName;
		pendingLoadSlot = null;
	}

	async function doDeleteSlot(slotName: string) {
		await gameState.removeSaveSlot(slotName);
		deletingSlotName = null;
		saveSlots = await gameState.getSaveSlotList();
	}

	function formatTimestamp(iso: string, currentLocale: string | null | undefined): string {
		try {
			return new Date(iso).toLocaleString(currentLocale ?? 'pt-BR');
		} catch {
			return iso;
		}
	}

	onDestroy(() => {
		unsubscribe();
		if (typewriterRaf) cancelAnimationFrame(typewriterRaf);
	});
</script>

<div class="game-panel">
	<div class="game-header">
		<h2 class="game-title">{displayName || gameName || $t('game.title')}</h2>
		<div class="game-controls">
			<button class="btn-icon" on:click={openSavePanel} title={$t('game.save.tooltip')} disabled={isLoadingSlot}>
				<FloppyDisk size={18} weight="regular" />
			</button>
			<button class="btn-icon" on:click={openLoadPanel} title={$t('game.load.tooltip')} disabled={isLoadingSlot}>
				<FolderOpen size={18} weight="regular" />
			</button>
			<button class="btn-icon" on:click={clearOutput} title={$t('game.clearOutput')}>
				<Trash size={18} weight="regular" />
			</button>
			<button class="btn-icon" on:click={requestRestart} title={$t('game.restart.tooltip')}>
				<ArrowCounterClockwise size={18} weight="regular" />
			</button>
			<button class="btn-icon" on:click={requestCloseGame} title={$t('game.close.tooltip')}>
				<X size={18} weight="regular" />
			</button>
		</div>
	</div>

	{#if saveMessage}
		<div class="save-feedback" transition:slide={{ duration: 150 }}>{saveMessage}</div>
	{/if}

	<!-- Inline close game confirmation -->
	{#if showCloseConfirm}
		<div class="confirm-strip" transition:slide={{ duration: 150 }}>
			<span><Warning size={16} weight="regular" /> {$t('game.close.confirm')}</span>
			<div class="confirm-actions">
				<button class="btn-danger" on:click={doCloseGame}>{$t('common.close')}</button>
				<button class="btn-cancel-sm" on:click={() => showCloseConfirm = false}>{$t('common.cancel')}</button>
			</div>
		</div>
	{/if}

	<!-- Inline restart confirmation -->
	{#if showRestartConfirm}
		<div class="confirm-strip" transition:slide={{ duration: 150 }}>
			<span><Warning size={16} weight="regular" /> {$t('game.restart.confirm')}</span>
			<div class="confirm-actions">
				<button class="btn-danger" on:click={doRestart}>{$t('game.restart.restart')}</button>
				<button class="btn-cancel-sm" on:click={() => showRestartConfirm = false}>{$t('common.cancel')}</button>
			</div>
		</div>
	{/if}

	<!-- Save panel -->
	{#if showSavePanel}
		<div class="save-load-panel" transition:slide={{ duration: 150 }}>
			<div class="panel-title"><FloppyDisk size={16} weight="regular" /> {$t('game.save.title')}</div>

			{#if lastSlotName}
				{#if showOverwriteConfirm}
					<div class="overwrite-row confirm-strip-inline" transition:slide={{ duration: 120 }}>
						<span>{$t('game.save.overwriteConfirm', { values: { name: lastSlotName } })}</span>
						<div class="confirm-actions">
							<button class="btn-confirm" on:click={confirmOverwrite} disabled={isSaving}>{$t('game.save.overwrite')}</button>
							<button class="btn-cancel-sm" on:click={() => showOverwriteConfirm = false}>{$t('common.cancel')}</button>
						</div>
					</div>
				{:else}
					<button class="overwrite-btn" on:click={() => showOverwriteConfirm = true} disabled={isSaving}>
						💾 {$t('game.save.overwriteSlot', { values: { name: lastSlotName } })}
					</button>
				{/if}
			{/if}

			<div class="panel-row">
				<input
					class="slot-input"
					type="text"
					placeholder={$t('game.save.slotPlaceholder')}
					bind:value={saveSlotName}
					bind:this={slotNameInput}
					on:keydown={(e) => e.key === 'Enter' && confirmSave()}
					maxlength="40"
				/>
				<button class="btn-confirm" on:click={confirmSave} disabled={!saveSlotName.trim() || isSaving}>
					{isSaving ? $t('game.save.saving') : $t('game.save.save')}
				</button>
				<button class="btn-cancel" on:click={() => { showSavePanel = false; }}>✕</button>
			</div>
			{#if saveSlots[saveSlotName.trim()]}
				<div class="overwrite-warn">⚠️ {$t('game.save.slotExists')}</div>
			{/if}
		</div>
	{/if}

	<!-- Load panel -->
	{#if showLoadPanel}
		<div class="save-load-panel" transition:slide={{ duration: 150 }}>
			<div class="panel-header-row">
				<div class="panel-title"><FolderOpen size={16} weight="regular" /> {$t('game.load.title')}</div>
				<button class="btn-cancel" on:click={() => { showLoadPanel = false; pendingLoadSlot = null; deletingSlotName = null; }}>✕</button>
			</div>

			{#if Object.keys(saveSlots).length === 0}
				<div class="no-slots">{$t('game.load.noSaves', { values: { name: gameName } })}</div>
			{:else}
				<!-- Inline load confirmation -->
				{#if pendingLoadSlot}
					<div class="confirm-strip-inline" transition:slide={{ duration: 120 }}>
						<span>{$t('game.load.restoreConfirm', { values: { name: pendingLoadSlot.slotName } })}</span>
						<div class="confirm-actions">
							<button class="btn-confirm" on:click={doLoadSlot} disabled={isLoadingSlot}>{$t('game.load.restore')}</button>
							<button class="btn-cancel-sm" on:click={() => pendingLoadSlot = null}>{$t('common.cancel')}</button>
						</div>
					</div>
				{/if}

				<div class="slot-list">
					{#each Object.values(saveSlots).sort((a, b) => b.timestamp.localeCompare(a.timestamp)) as slot}
						<div class="slot-item" class:confirming={deletingSlotName === slot.slotName}>
							{#if deletingSlotName === slot.slotName}
								<!-- Inline delete confirmation on the item itself -->
								<span class="delete-confirm-text">{$t('game.delete.deleteConfirm', { values: { name: slot.slotName } })}</span>
								<div class="slot-actions">
									<button class="btn-danger-sm" on:click={() => doDeleteSlot(slot.slotName)}>{$t('game.delete.delete')}</button>
									<button class="btn-cancel-sm" on:click={() => deletingSlotName = null}>{$t('common.cancel')}</button>
								</div>
							{:else}
								<div class="slot-info">
									<span class="slot-name">{slot.slotName}</span>
									<span class="slot-date">{formatTimestamp(slot.timestamp, $locale)}</span>
								</div>
								<div class="slot-actions">
									<button
										class="btn-load"
										class:selected={pendingLoadSlot?.slotName === slot.slotName}
										on:click={() => requestLoadSlot(slot)}
										disabled={isLoadingSlot}
									>
										{$t('game.load.load')}
									</button>
									<button class="btn-delete" on:click={() => requestDeleteSlot(slot.slotName)} title={$t('game.load.deleteSlotTooltip')}>
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

	<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
	<div class="output-container" bind:this={outputContainer} on:click={focusCommandInput}>
		{#if gameOutput.length === 0}
			<div class="welcome-message">
				<p>{$t('game.welcome')}</p>
				<p class="hint">{$t('game.welcomeHint')}</p>
			</div>
		{:else}
			{#each gameOutput as output, i}
				<div class="output-line" class:command={output.startsWith('>')}>
					{i === typingIndex ? output.slice(0, typingCharsShown) : output}{#if i === typingIndex}<span class="cursor">▊</span>{/if}
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
			placeholder={$t('game.commandPlaceholder')}
			class="command-input"
			class:focus-pulse={focusFromClick}
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
		color: var(--accent);
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

	/* ---- Save feedback ---- */
	.save-feedback {
		background: var(--success-bg);
		color: var(--success-text);
		text-align: center;
		padding: 0.35rem 1rem;
		font-size: 0.88rem;
		border-bottom: 1px solid var(--success-border);
		flex-shrink: 0;
	}

	/* ---- Inline restart confirmation ---- */
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

	.overwrite-btn {
		width: 100%;
		padding: 0.45rem 0.75rem;
		margin-bottom: 0.5rem;
		background: var(--btn-bg);
		border: 1px solid var(--border-light);
		color: var(--text-secondary);
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.85rem;
		text-align: left;
		transition: background 0.2s, border-color 0.2s;
	}

	.overwrite-btn:hover:not(:disabled) {
		background: var(--btn-hover);
		border-color: var(--accent);
		color: var(--accent);
	}

	.overwrite-row {
		margin-bottom: 0.5rem;
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

	/* Inline confirmation in load panel */
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
		cursor: text;
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

	.cursor {
		animation: blink 0.8s infinite;
		color: var(--accent);
		font-size: 0.9em;
	}

	@keyframes blink {
		0%, 50% { opacity: 1; }
		51%, 100% { opacity: 0; }
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

	.command-input.focus-pulse {
		animation: input-pulse 0.3s ease-out;
	}

	@keyframes input-pulse {
		0% { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 30%, transparent); }
		100% { border-color: var(--accent); box-shadow: none; }
	}

	.command-input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
