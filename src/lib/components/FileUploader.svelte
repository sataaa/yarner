<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher<{
		gameLoaded: { filename: string; data: ArrayBuffer };
	}>();

	let fileInput: HTMLInputElement;
	let selectedFile: File | null = null;
	let error: string = '';
	let isLoading = false;

	function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		const files = target.files;

		if (!files || files.length === 0) {
			return;
		}

		const file = files[0];
		selectedFile = file;
		error = '';

		// Validate file extension
		const validExtensions = ['.z3', '.z4', '.z5', '.z8', '.zblorb'];
		const extension = file.name.toLowerCase().match(/\.[^.]+$/)?.[0];

		if (!extension || !validExtensions.includes(extension)) {
			error = `Invalid file type. Please select a Z-Machine file (${validExtensions.join(', ')})`;
			selectedFile = null;
			return;
		}

		// Auto-load the file
		loadFile(file);
	}

	async function loadFile(file: File) {
		isLoading = true;
		error = '';

		try {
			const arrayBuffer = await file.arrayBuffer();

			// Basic validation: check if it looks like a Z-Machine file
			const view = new DataView(arrayBuffer);
			const version = view.getUint8(0);

			if (version < 1 || version > 8) {
				throw new Error('This does not appear to be a valid Z-Machine file');
			}

			// Dispatch event with the loaded game data
			dispatch('gameLoaded', {
				filename: file.name,
				data: arrayBuffer
			});
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load file';
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
		if (fileInput) {
			fileInput.value = '';
		}
	}
</script>

<div class="file-uploader">
	<div class="upload-area">
		<input
			type="file"
			accept=".z3,.z4,.z5,.z8,.zblorb"
			on:change={handleFileSelect}
			bind:this={fileInput}
			class="file-input"
		/>

		{#if !selectedFile}
			<div class="upload-prompt">
				<div class="icon">📁</div>
				<h3>Load a Z-Machine Game</h3>
				<p>Select a .z5, .z8, or other Z-Machine story file</p>
				<button class="btn-primary" on:click={triggerFileInput} disabled={isLoading}>
					{isLoading ? 'Loading...' : 'Choose File'}
				</button>
			</div>
		{:else}
			<div class="file-info">
				<div class="icon">🎮</div>
				<h3>{selectedFile.name}</h3>
				<p class="file-size">{(selectedFile.size / 1024).toFixed(2)} KB</p>
				{#if isLoading}
					<p class="loading">Loading game...</p>
				{:else}
					<button class="btn-secondary" on:click={clearFile}>Choose Different File</button>
				{/if}
			</div>
		{/if}

		{#if error}
			<div class="error-message">
				<strong>Error:</strong> {error}
			</div>
		{/if}
	</div>

	<div class="info-section">
		<h4>Need a game to play?</h4>
		<p>Download free interactive fiction games from:</p>
		<ul>
			<li><a href="https://ifdb.org/" target="_blank" rel="noopener">IFDB</a> - Interactive Fiction Database</li>
			<li><a href="https://www.ifarchive.org/" target="_blank" rel="noopener">IF Archive</a> - Classic games</li>
		</ul>
		<p class="note">Look for files ending in .z5, .z8, or .zblorb</p>
	</div>
</div>

<style>
	.file-uploader {
		max-width: 600px;
		margin: 2rem auto;
		padding: 2rem;
	}

	.upload-area {
		background: #2a2a2a;
		border: 2px dashed #4a4a4a;
		border-radius: 12px;
		padding: 3rem 2rem;
		text-align: center;
		transition: border-color 0.3s;
	}

	.upload-area:hover {
		border-color: #ffa500;
	}

	.file-input {
		display: none;
	}

	.upload-prompt,
	.file-info {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	.icon {
		font-size: 4rem;
		margin-bottom: 0.5rem;
	}

	h3 {
		margin: 0;
		color: #ffa500;
		font-size: 1.5rem;
	}

	p {
		margin: 0;
		color: #b0b0b0;
	}

	.file-size {
		font-size: 0.9rem;
		color: #888;
	}

	.loading {
		color: #ffa500;
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
		transition: all 0.3s;
	}

	.btn-primary {
		background: #ffa500;
		color: #1a1a1a;
	}

	.btn-primary:hover:not(:disabled) {
		background: #ff8c00;
		transform: translateY(-2px);
		box-shadow: 0 4px 8px rgba(255, 165, 0, 0.3);
	}

	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-secondary {
		background: #3a3a3a;
		color: #e0e0e0;
	}

	.btn-secondary:hover {
		background: #4a4a4a;
	}

	.error-message {
		margin-top: 1rem;
		padding: 1rem;
		background: #ff4444;
		color: white;
		border-radius: 6px;
		font-size: 0.9rem;
	}

	.info-section {
		margin-top: 2rem;
		padding: 1.5rem;
		background: #2a2a2a;
		border-radius: 8px;
	}

	.info-section h4 {
		margin-top: 0;
		color: #ffa500;
	}

	.info-section ul {
		list-style: none;
		padding: 0;
	}

	.info-section li {
		margin: 0.5rem 0;
	}

	.info-section a {
		color: #6db3f2;
		text-decoration: none;
		transition: color 0.3s;
	}

	.info-section a:hover {
		color: #ffa500;
		text-decoration: underline;
	}

	.note {
		font-size: 0.85rem;
		color: #888;
		margin-top: 1rem;
		font-style: italic;
	}
</style>
