<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { t } from 'svelte-i18n';
	import Folder from 'phosphor-svelte/lib/Folder';
	import FolderOpen from 'phosphor-svelte/lib/FolderOpen';
	import GameController from 'phosphor-svelte/lib/GameController';

	const dispatch = createEventDispatcher<{
		gameLoaded: { filename: string; data: ArrayBuffer };
	}>();

	let fileInput: HTMLInputElement;
	let selectedFile: File | null = null;
	let error: string = '';
	let isLoading = false;
	let isDragging = false;

	const validExtensions = ['.z3', '.z4', '.z5', '.z8', '.zblorb'];

	function validateAndLoad(file: File) {
		selectedFile = file;
		error = '';

		const extension = file.name.toLowerCase().match(/\.[^.]+$/)?.[0];
		if (!extension || !validExtensions.includes(extension)) {
			error = $t('upload.invalidFile', { values: { extensions: validExtensions.join(', ') } });
			selectedFile = null;
			return;
		}
		loadFile(file);
	}

	function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		const files = target.files;
		if (!files || files.length === 0) return;
		validateAndLoad(files[0]);
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		isDragging = true;
	}

	function handleDragLeave(event: DragEvent) {
		// Only end drag if the cursor left the element completely
		const rel = event.relatedTarget as Node | null;
		const target = event.currentTarget as HTMLElement;
		if (!rel || !target.contains(rel)) {
			isDragging = false;
		}
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragging = false;
		const files = event.dataTransfer?.files;
		if (!files || files.length === 0) return;
		validateAndLoad(files[0]);
	}

	async function loadFile(file: File) {
		isLoading = true;
		error = '';

		try {
			const arrayBuffer = await file.arrayBuffer();

			// Basic validation: check if it's a valid Z-Machine file
			const view = new DataView(arrayBuffer);
			const version = view.getUint8(0);

			if (version < 1 || version > 8) {
				throw new Error($t('upload.notZMachine'));
			}

			dispatch('gameLoaded', { filename: file.name, data: arrayBuffer });
		} catch (err) {
			error = err instanceof Error ? err.message : $t('upload.loadFailed');
			selectedFile = null;
		} finally {
			isLoading = false;
		}
	}

	function triggerFileInput() {
		fileInput.click();
	}

	function clearFile() {
		selectedFile = null;
		error = '';
		if (fileInput) fileInput.value = '';
	}

	/** Resets the uploader to initial state (called by parent after upload) */
	export function reset() {
		clearFile();
	}
</script>

<div class="file-uploader">
	<div
		class="upload-area"
		class:dragging={isDragging}
		on:dragover={handleDragOver}
		on:dragleave={handleDragLeave}
		on:drop={handleDrop}
		role="button"
		tabindex="0"
		on:keydown={(e) => e.key === 'Enter' && triggerFileInput()}
		aria-label={$t('upload.uploadAreaLabel')}
	>
		<input
			type="file"
			accept=".z3,.z4,.z5,.z8,.zblorb"
			on:change={handleFileSelect}
			bind:this={fileInput}
			class="file-input"
		/>

		{#if !selectedFile}
			<div class="upload-prompt">
				<div class="icon">{#if isDragging}<FolderOpen size={40} weight="regular" />{:else}<Folder size={40} weight="regular" />{/if}</div>
				<h3>{$t('upload.heading')}</h3>
				<p>{$t('upload.dragPrompt')}</p>
				<p class="formats">{$t('upload.formats')}</p>
				<button class="btn-primary" on:click={triggerFileInput} disabled={isLoading}>
					{isLoading ? $t('common.loading') : $t('upload.chooseFile')}
				</button>
			</div>
		{:else}
			<div class="file-info">
				<div class="icon"><GameController size={40} weight="regular" /></div>
				<h3>{selectedFile.name}</h3>
				<p class="file-size">{(selectedFile.size / 1024).toFixed(2)} KB</p>
				{#if isLoading}
					<p class="loading">{$t('upload.loadingGame')}</p>
				{:else}
					<button class="btn-secondary" on:click={clearFile}>{$t('upload.chooseOtherFile')}</button>
				{/if}
			</div>
		{/if}

		{#if error}
			<div class="error-message">
				<strong>{$t('common.error')}:</strong> {error}
			</div>
		{/if}
	</div>

	<div class="info-section">
		<h4>{$t('upload.needAGame')}</h4>
		<p>{$t('upload.downloadGames')}</p>
		<ul>
			<li><a href="https://ifdb.org/" target="_blank" rel="noopener">IFDB</a> — {$t('upload.ifdb')}</li>
			<li><a href="https://www.ifarchive.org/" target="_blank" rel="noopener">IF Archive</a> — {$t('upload.ifArchive')}</li>
		</ul>
		<p class="note">{$t('upload.searchHint')}</p>
	</div>
</div>

<style>
	.file-uploader {
		padding: 2rem 0;
	}

	.upload-area {
		background: var(--bg-elevated);
		border: 2px dashed var(--border-light);
		border-radius: 12px;
		padding: 3rem 2rem;
		text-align: center;
		transition: border-color 0.2s, background 0.2s;
		cursor: default;
	}

	.upload-area:hover {
		border-color: var(--accent);
	}

	.upload-area.dragging {
		border-color: var(--accent);
		background: var(--upload-drag-bg);
		border-style: solid;
	}

	.file-input {
		display: none;
	}

	.upload-prompt,
	.file-info {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
	}

	.icon {
		font-size: 4rem;
		color: var(--accent);
	}

	h3 {
		margin: 0;
		color: var(--accent);
		font-size: 1.5rem;
	}

	p {
		margin: 0;
		color: var(--text-secondary);
	}

	.formats {
		font-size: 0.85rem;
		color: var(--text-faint);
		letter-spacing: 0.05em;
	}

	.file-size {
		font-size: 0.9rem;
		color: var(--text-faint);
	}

	.loading {
		color: var(--accent);
		font-style: italic;
	}

	.btn-primary,
	.btn-secondary {
		padding: 0.75rem 2rem;
		font-size: 1rem;
		font-weight: 600;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.2s;
		margin-top: 0.25rem;
	}

	.btn-primary {
		background: var(--accent);
		color: var(--accent-text-on);
	}

	.btn-primary:hover:not(:disabled) {
		background: var(--accent-dark);
		transform: translateY(-2px);
		box-shadow: 0 4px 8px rgba(255, 165, 0, 0.3);
	}

	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-secondary {
		background: var(--btn-bg);
		color: var(--text-primary);
	}

	.btn-secondary:hover {
		background: var(--btn-hover);
	}

	.error-message {
		margin-top: 1rem;
		padding: 1rem;
		background: var(--error-dim-bg);
		color: var(--error-text);
		border: 1px solid var(--error-border);
		border-radius: 6px;
		font-size: 0.9rem;
	}

	.info-section {
		margin-top: 2rem;
		padding: 1.5rem;
		background: var(--bg-elevated);
		border-radius: 8px;
	}

	.info-section h4 {
		margin-top: 0;
		color: var(--accent);
	}

	.info-section ul {
		list-style: none;
		padding: 0;
	}

	.info-section li {
		margin: 0.5rem 0;
	}

	.info-section a {
		color: var(--link-color);
		text-decoration: none;
		transition: color 0.2s;
	}

	.info-section a:hover {
		color: var(--accent);
		text-decoration: underline;
	}

	.note {
		font-size: 0.85rem;
		color: var(--text-faint);
		margin-top: 1rem;
		font-style: italic;
	}
</style>
