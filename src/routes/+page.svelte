<script lang="ts">
	// Yarner - AI-Assisted Text Adventure Player

	import FileUploader from '$lib/components/FileUploader.svelte';
	import GamePanel from '$lib/components/GamePanel.svelte';
	import AIAssistant from '$lib/components/AIAssistant.svelte';
	import GameLibrary from '$lib/components/GameLibrary.svelte';
	import { gameState, isGameLoaded, currentGameName } from '$lib/stores/gameState';
	import { aiChat } from '$lib/stores/aiChat';
	import { slide } from 'svelte/transition';
	import {
		clearGameAIData,
		clearAllData,
		computeSHA256,
		addGameToLibrary,
		getGameFromLibrary,
		getGameLibrary,
		updateLastPlayed,
		saveAIMemory,
		saveChatHistory,
		type GameLibraryEntry,
		type SaveSlot
	} from '$lib/stores/aiPersistence';
	import { currentTheme, themes } from '$lib/stores/themeStore';
	import { getValidatedGameName } from '$lib/data/validatedGames';
	import { t, locale } from 'svelte-i18n';
	import { cycleLocale, getLocaleLabel, getLocaleIcon } from '$lib/i18n';

	let errorMessage = '';
	let gameLibraryRef: GameLibrary;
	let fileUploaderRef: FileUploader;
	let displayName = '';
	let lastSlotName = '';

	// ---- Clear all data ----
	let showClearConfirm = false;
	let clearConfirmText = '';
	let isClearing = false;

	async function handleClearAllData() {
		if (clearConfirmText !== 'DELETE') return;
		isClearing = true;
		try {
			await clearAllData();
			window.location.reload();
		} catch (error) {
			console.error('Failed to clear data:', error);
			isClearing = false;
		}
	}

	async function handleGameLoaded(event: CustomEvent<{ filename: string; data: ArrayBuffer }>) {
		const { filename, data } = event.detail;
		errorMessage = '';

		try {
			const sha256 = await computeSHA256(data);
			const existing = await getGameFromLibrary(sha256);

			if (existing) {
				// Game already in library — highlight it in the list with inline message
				fileUploaderRef?.reset();
				gameLibraryRef?.highlightGame(sha256);
				return;
			}

			// New game — add to library (without starting)
			fileUploaderRef?.reset();
			const gameName = filename.replace(/\.[^.]+$/, '');
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
			await gameLibraryRef?.refresh();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : $t('game.loadFailed');
			console.error('Error loading game:', error);
		}
	}

	async function handleLoadFromLibrary(event: CustomEvent<{ filename: string; data: ArrayBuffer }>) {
		const { filename, data } = event.detail;
		errorMessage = '';

		try {
			// Resolve displayName BEFORE loading — prevents gameName flash in the title
			const sha256 = await computeSHA256(data);
			displayName = getValidatedGameName(sha256) ?? '';
			lastSlotName = '';

			// Loading from library = start fresh (new playthrough)
			// Clear AI data from IDB BEFORE loadGame — the reactive loadAIStateForGame
			// triggers when isGameLoaded is set and reloads from IDB (now empty).
			const gameName = filename.replace(/\.[^.]+$/, '');
			aiChat.resetAIChat();
			await clearGameAIData(gameName);
			await gameState.loadGame(filename, data);
			await updateLastPlayed(sha256);
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : $t('game.loadFailed');
			console.error('Error loading game from library:', error);
		}
	}

	async function handleLoadFromSave(event: CustomEvent<{ slot: SaveSlot }>) {
		const { slot } = event.detail;
		errorMessage = '';

		try {
			// Resolve displayName from the original SHA in the library (not from slot.gameData,
			// which may have been mutated by the VM during game execution).
			const library = await getGameLibrary();
			const libraryEntry = library.find(g => g.gameName === slot.gameName);
			displayName = libraryEntry ? (getValidatedGameName(libraryEntry.sha256) ?? '') : '';
			lastSlotName = slot.slotName;

			// Persist the AI state from the slot into IDB BEFORE loading.
			// Cannot use restoreAIMemoryFromSave() because it reads gameState.gameName
			// which is empty on the home screen — the if(gameName) check fails.
			// Here we use the slot's own gameName directly.
			await saveAIMemory(slot.gameName, slot.aiMemory ?? []);
			await saveChatHistory(slot.gameName, slot.aiChatMessages ?? []);
			await gameState.loadFromSaveSlot(slot);
			if (libraryEntry) await updateLastPlayed(libraryEntry.sha256);
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : $t('game.restoreFailed');
			console.error('Error loading save from library:', error);
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
		<span class="tagline">{$t('header.tagline')}</span>
		<div class="spacer"></div>
		<button class="header-btn" on:click={cycleLocale} title={$t('header.changeLocale', { values: { locale: getLocaleLabel($locale) } })}>
			{getLocaleIcon($locale)} {getLocaleLabel($locale)}
		</button>
		<button class="header-btn" on:click={cycleTheme} title={$t('header.changeTheme', { values: { theme: activeTheme.label } })}>
			{activeTheme.icon} {activeTheme.label}
		</button>
	</header>

	{#if errorMessage}
		<div class="error-banner">
			<strong>{$t('common.error')}:</strong> {errorMessage}
			<button on:click={() => errorMessage = ''}>×</button>
		</div>
	{/if}

	{#if !$isGameLoaded}
		<div class="upload-screen">
			<div class="upload-wrapper">
				<FileUploader bind:this={fileUploaderRef} on:gameLoaded={handleGameLoaded} />
				<GameLibrary bind:this={gameLibraryRef} on:loadFromLibrary={handleLoadFromLibrary} on:loadFromSave={handleLoadFromSave} />
			</div>

			<div class="clear-data-section">
				{#if !showClearConfirm}
					<button class="btn-clear-data" on:click={() => showClearConfirm = true}>
						{$t('settings.clearAllData')}
					</button>
				{:else}
					<div class="clear-confirm" transition:slide={{ duration: 200 }}>
						<p class="clear-warning">{$t('settings.clearWarning')}</p>
						<div class="clear-confirm-row">
							<input
								type="text"
								bind:value={clearConfirmText}
								placeholder={$t('settings.clearTypePlaceholder')}
								class="clear-confirm-input"
							/>
							<button
								class="btn-danger-sm"
								on:click={handleClearAllData}
								disabled={clearConfirmText !== 'DELETE' || isClearing}
							>
								{isClearing ? $t('common.loading') : $t('settings.clearConfirm')}
							</button>
							<button class="btn-cancel-sm" on:click={() => { showClearConfirm = false; clearConfirmText = ''; }}>
								{$t('common.cancel')}
							</button>
						</div>
					</div>
				{/if}
			</div>
		</div>
	{:else}
		<div class="container">
			<div class="panel game-panel">
				<GamePanel gameName={$currentGameName} {displayName} bind:lastSlotName />
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

	.header-btn {
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

	.header-btn:hover {
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
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		background: var(--bg-base);
		overflow-y: auto;
		padding: 2rem 1rem;
	}

	.upload-wrapper {
		display: flex;
		gap: 1.5rem;
		max-width: 1000px;
		width: 100%;
		align-items: flex-start;
	}

	.upload-wrapper > :global(:first-child) {
		flex: 1;
		min-width: 0;
	}

	.upload-wrapper > :global(:last-child) {
		flex: 1;
		min-width: 0;
	}

	@media (max-width: 768px) {
		.upload-wrapper {
			flex-direction: column;
			max-width: 600px;
			align-items: stretch;
		}
	}

	.clear-data-section {
		margin-top: 2rem;
		text-align: center;
		width: 100%;
		max-width: 1000px;
	}

	.btn-clear-data {
		background: none;
		border: none;
		color: var(--text-faint);
		font-size: 0.75rem;
		cursor: pointer;
		text-decoration: underline;
		opacity: 0.5;
		transition: opacity 0.2s, color 0.2s;
	}

	.btn-clear-data:hover {
		opacity: 1;
		color: var(--error-text);
	}

	.clear-confirm {
		background: var(--bg-elevated);
		border: 1px solid var(--error-border, var(--border));
		border-radius: 6px;
		padding: 1rem;
		max-width: 420px;
		margin: 0 auto;
	}

	.clear-warning {
		color: var(--error-text);
		font-size: 0.85rem;
		margin: 0 0 0.75rem;
	}

	.clear-confirm-row {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.clear-confirm-input {
		flex: 1;
		background: var(--bg-input, var(--bg-base));
		border: 1px solid var(--border-light, var(--border));
		color: var(--text-primary);
		padding: 0.4rem 0.75rem;
		border-radius: 4px;
		font-family: monospace;
		font-size: 0.85rem;
	}

	.btn-danger-sm {
		background: var(--error-bg);
		border: 1px solid var(--error-border, var(--border));
		color: var(--error-text);
		padding: 0.35rem 0.75rem;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.8rem;
		white-space: nowrap;
	}

	.btn-danger-sm:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.btn-cancel-sm {
		background: var(--btn-bg, transparent);
		border: 1px solid var(--border-light, var(--border));
		color: var(--text-secondary);
		padding: 0.35rem 0.75rem;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.8rem;
		white-space: nowrap;
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
