<script lang="ts">
	/**
	 * AIAssistant — Chat interface for the AI game assistant.
	 *
	 * Connects to an OpenAI-compatible API (LM Studio, Ollama, OpenAI, etc.)
	 * Shows chat interface directly — no API key required for local servers.
	 */
	import { onMount, onDestroy } from 'svelte';
	import { slide } from 'svelte/transition';
	import {
		aiMessages,
		aiGameStatus,
		aiIsLoading,
		aiIsStreaming,
		aiStreamingContent,
		aiError,
		aiChat,
		aiProviderId,
		aiApiUrl,
		aiModel,
		locationMapExpanded
	} from '$lib/stores/aiChat';
	import { PROVIDER_PRESETS, fetchAvailableModels } from '$lib/api/claude';
	import type { ModelOption } from '$lib/api/claude';
	import { isGameLoaded, currentGameName } from '$lib/stores/gameState';
	import LocationMap from './LocationMap.svelte';

	let messageInput = '';
	let messagesContainer: HTMLDivElement;
	let showGameStatus = false;
	let showLocationMap = false;
	let showSettings = false;
	let debugMode = false;

	// Local form state for settings (synced from store)
	let settingsApiKey = '';
	let settingsModel = '';
	let settingsApiUrl = '';
	let availableModels: ModelOption[] = [];
	let loadingModels = false;

	/** Sync local form fields when settings panel opens */
	function openSettings() {
		showSettings = !showSettings;
		if (showSettings) {
			settingsApiKey = localStorage.getItem('yarner-api-key') || '';
			settingsModel = $aiModel;
			settingsApiUrl = $aiApiUrl;
			loadModelsForProvider($aiProviderId, settingsApiKey);
		}
	}

	async function loadModelsForProvider(providerId: string, apiKey: string) {
		availableModels = [];
		if (providerId === 'lmstudio' || providerId === 'custom') return;
		loadingModels = true;
		availableModels = await fetchAvailableModels(providerId, apiKey);
		loadingModels = false;
	}

	function handleProviderChange(event: Event) {
		const select = event.target as HTMLSelectElement;
		const preset = PROVIDER_PRESETS.find((p) => p.id === select.value);
		if (preset) {
			aiChat.setProvider(preset.id);
			settingsModel = preset.defaultModel;
			settingsApiUrl = preset.apiUrl;
			loadModelsForProvider(preset.id, settingsApiKey);
		}
	}

	function handleApiKeySave() {
		aiChat.setApiKey(settingsApiKey.trim());
		loadModelsForProvider($aiProviderId, settingsApiKey.trim());
	}

	function handleModelSave() {
		aiChat.setProvider($aiProviderId, undefined, settingsModel.trim());
	}

	function handleApiUrlSave() {
		aiChat.setProvider($aiProviderId, settingsApiUrl.trim());
	}

	$: currentPreset = PROVIDER_PRESETS.find((p) => p.id === $aiProviderId);
	$: providerRequiresKey = currentPreset?.requiresKey ?? false;

	// Quando o mapa expande para terceira coluna, fecha o modo inline
	$: if ($locationMapExpanded) showLocationMap = false;

	function toggleLocationMap() {
		showLocationMap = !showLocationMap;
		if (!showLocationMap && $locationMapExpanded) {
			locationMapExpanded.set(false);
		}
	}

	onMount(() => {
		aiChat.initAIChat();
	});

	$: if ($isGameLoaded && $currentGameName) {
		aiChat.loadAIStateForGame($currentGameName);
	}

	/** Detecta quando o streaming está na fase de receber o JSON de status (invisível ao usuário) */
	$: isUpdatingStatus = $aiIsStreaming && $aiStreamingContent.includes('GAME_STATUS_JSON_START');

	// ---- Typewriter effect ----
	// The actual streaming content arrives in large chunks (especially from Gemini).
	// We reveal it gradually via a display buffer that catches up using requestAnimationFrame.
	let displayedStreamText = '';
	let typewriterRaf = 0;
	/** How many characters to reveal per animation frame */
	const CHARS_PER_FRAME = 3;

	$: if ($aiStreamingContent) {
		startTypewriter();
	}

	// Reset when streaming ends
	$: if (!$aiIsStreaming) {
		cancelAnimationFrame(typewriterRaf);
		typewriterRaf = 0;
		displayedStreamText = '';
	}

	function startTypewriter() {
		if (typewriterRaf) return; // already running
		typewriterRaf = requestAnimationFrame(typewriterTick);
	}

	function typewriterTick() {
		const target = $aiStreamingContent;
		if (!target || !$aiIsStreaming) {
			typewriterRaf = 0;
			return;
		}
		if (displayedStreamText.length < target.length) {
			// Reveal a few characters per frame for smooth animation
			displayedStreamText = target.slice(0, displayedStreamText.length + CHARS_PER_FRAME);
			typewriterRaf = requestAnimationFrame(typewriterTick);
		} else {
			// Caught up — wait for more content
			typewriterRaf = 0;
		}
	}

	onDestroy(() => {
		if (typewriterRaf) cancelAnimationFrame(typewriterRaf);
	});

	$: if (($aiMessages.length > 0 || displayedStreamText) && messagesContainer) {
		setTimeout(() => {
			messagesContainer.scrollTop = messagesContainer.scrollHeight;
		}, 10);
	}

	async function handleSendMessage() {
		const msg = messageInput.trim();
		if (!msg || $aiIsLoading) return;
		messageInput = '';
		await aiChat.sendMessageToAI(msg);
	}

	function handleMessageKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			handleSendMessage();
		}
	}

	/**
	 * Remove o bloco JSON de game-status do conteúdo em streaming.
	 * O bloco aparece no final da resposta e não deve ser exibido ao usuário.
	 */
	function stripStatusBlock(text: string): string {
		return text
			.replace(/GAME_STATUS_JSON_START[\s\S]*$/m, '')
			.replace(/```game-status[\s\S]*$/m, '')
			.replace(/```json\s*\n\{[\s\S]*$/m, '')
			.trim();
	}

	/**
	 * Converte markdown básico para HTML seguro (sem XSS).
	 * Escapa entidades HTML antes de aplicar as transformações.
	 * Suporta: negrito, itálico, código inline, listas (- e 1.), quebras de linha.
	 */
	function renderMarkdown(raw: string): string {
		// 1. Escapar entidades HTML (prevenção de XSS)
		let s = raw
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');

		// 2. Inline: negrito+itálico, negrito, itálico, código
		s = s.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
		s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
		s = s.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
		s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');

		// 3. Processar linha a linha para listas e parágrafos
		const lines = s.split('\n');
		const out: string[] = [];
		let inUl = false;
		let inOl = false;

		const closeList = () => {
			if (inUl) { out.push('</ul>'); inUl = false; }
			if (inOl) { out.push('</ol>'); inOl = false; }
		};

		for (const line of lines) {
			const ulMatch = line.match(/^[-*] (.+)/);
			const olMatch = line.match(/^\d+\. (.+)/);

			if (ulMatch) {
				if (inOl) { out.push('</ol>'); inOl = false; }
				if (!inUl) { out.push('<ul>'); inUl = true; }
				out.push(`<li>${ulMatch[1]}</li>`);
			} else if (olMatch) {
				if (inUl) { out.push('</ul>'); inUl = false; }
				if (!inOl) { out.push('<ol>'); inOl = true; }
				out.push(`<li>${olMatch[1]}</li>`);
			} else {
				closeList();
				if (line.trim() === '') {
					out.push('<br>');
				} else {
					out.push(line + '<br>');
				}
			}
		}

		closeList();
		return out.join('');
	}
</script>

<div class="ai-assistant">
	<!-- Cabeçalho do chat -->
	<div class="chat-header">
		<h2>Assistente IA <span class="model-badge" class:remote={currentPreset?.requiresKey}>{$aiModel}{#if currentPreset?.requiresKey} · remoto{:else} · local{/if}</span></h2>
		<div class="header-controls">
			<button
				class="btn-icon"
				class:active={showGameStatus}
				on:click={() => (showGameStatus = !showGameStatus)}
				title="Status do jogo"
			>
				📋
			</button>
			<button
				class="btn-icon"
				class:active={showLocationMap || $locationMapExpanded}
				on:click={toggleLocationMap}
				title="Mapa de locais"
			>
				🗺️
			</button>
			<button
				class="btn-icon"
				on:click={() => aiChat.clearChatMessages()}
				title="Limpar chat (mantém status do jogo)"
				disabled={$aiMessages.length === 0}
			>
				🗑️
			</button>
			<button
				class="btn-icon"
				class:active={showSettings}
				on:click={openSettings}
				title="Configurações de IA"
			>
				⚙️
			</button>
		</div>
	</div>

	<!-- Painel de configurações de IA (colapsável) -->
	{#if showSettings}
		<div class="settings-panel" transition:slide={{ duration: 200 }}>
			<div class="settings-field">
				<label for="provider-select">Provider</label>
				<select id="provider-select" value={$aiProviderId} on:change={handleProviderChange}>
					{#each PROVIDER_PRESETS as preset}
						<option value={preset.id}>{preset.name}</option>
					{/each}
				</select>
			</div>

			{#if providerRequiresKey}
				<div class="settings-field">
					<label for="api-key-input">API Key</label>
					<div class="input-row">
						<input
							id="api-key-input"
							type="password"
							bind:value={settingsApiKey}
							on:blur={handleApiKeySave}
							placeholder="Cole sua API key aqui"
						/>
					</div>
					{#if $aiProviderId === 'gemini'}
						<p class="settings-hint">
							Pegue sua key grátis em <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Google AI Studio</a>
						</p>
					{/if}
				</div>
			{/if}

			<div class="settings-field">
				<label for="model-input">Modelo {#if loadingModels}<span class="loading-hint">carregando...</span>{/if}</label>
				{#if availableModels.length > 0}
					<select
						id="model-input"
						bind:value={settingsModel}
						on:change={handleModelSave}
					>
						{#each availableModels as m}
							<option value={m.id}>{m.name}</option>
						{/each}
					</select>
				{:else}
					<input
						id="model-input"
						type="text"
						bind:value={settingsModel}
						on:blur={handleModelSave}
						placeholder="Nome do modelo"
					/>
				{/if}
			</div>

			{#if $aiProviderId === 'custom'}
				<div class="settings-field">
					<label for="url-input">URL da API</label>
					<input
						id="url-input"
						type="text"
						bind:value={settingsApiUrl}
						on:blur={handleApiUrlSave}
						placeholder="https://..."
					/>
				</div>
			{/if}

			<div class="settings-field settings-toggle">
				<label for="debug-toggle">Debug</label>
				<label class="toggle-switch">
					<input id="debug-toggle" type="checkbox" bind:checked={debugMode} />
					<span class="toggle-label">{debugMode ? 'ON' : 'OFF'}</span>
				</label>
			</div>
		</div>
	{/if}

	<!-- Painel de status do jogo (colapsável) -->
	{#if showGameStatus}
		<div class="game-status-panel" transition:slide={{ duration: 200 }}>
			<div class="status-section">
				<h4>📍 Localização</h4>
				<p>{$aiGameStatus.localizacaoAtual || 'Desconhecida'}</p>
			</div>

			{#if $aiGameStatus.inventario.length > 0}
				<div class="status-section">
					<h4>🎒 Inventário</h4>
					<ul>
						{#each $aiGameStatus.inventario as item}
							<li>{item}</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if $aiGameStatus.objetivos.length > 0}
				<div class="status-section">
					<h4>🎯 Objetivos</h4>
					<ul>
						{#each $aiGameStatus.objetivos as obj}
							<li>{obj}</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if $aiGameStatus.coisasNaoExploradas.length > 0}
				<div class="status-section">
					<h4>🔍 Não explorado</h4>
					<ul>
						{#each $aiGameStatus.coisasNaoExploradas as coisa}
							<li>{coisa}</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if $aiGameStatus.observacoes.length > 0}
				<div class="status-section">
					<h4>📝 Observações</h4>
					<ul>
						{#each $aiGameStatus.observacoes as obs}
							<li>{obs}</li>
						{/each}
					</ul>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Mapa inline (oculto quando expandido para terceira coluna) -->
	{#if showLocationMap && !$locationMapExpanded}
		<div class="location-map-panel" transition:slide={{ duration: 200 }}>
			<LocationMap expanded={false} />
		</div>
	{/if}

	<!-- Área de mensagens -->
	<div class="messages-area" bind:this={messagesContainer}>
		{#if $aiMessages.length === 0 && !$aiIsStreaming}
			<div class="empty-chat">
				<div class="empty-icon">🤖</div>
				<p>Jogue um pouco e depois me pergunte qualquer coisa sobre o jogo!</p>
				<div class="empty-hints">
					{#each ['onde estou?', 'o que devo fazer?', 'que itens tenho?', 'dê uma dica'] as hint}
						<span
							role="button"
							tabindex="0"
							on:click={async () => { messageInput = hint; await handleSendMessage(); }}
							on:keydown={async (e) => { if (e.key === 'Enter') { messageInput = hint; await handleSendMessage(); } }}
						>
							"{hint}"
						</span>
					{/each}
				</div>
			</div>
		{/if}

		{#each $aiMessages as msg}
			<div class="message {msg.role}">
				<div class="message-content">
					{#if msg.role === 'assistant'}
						<!-- Renderiza markdown nas respostas do assistente -->
						{@html renderMarkdown(msg.content)}
					{:else}
						{msg.content}
					{/if}
				</div>
			</div>
		{/each}

		<!-- Resposta em streaming (ao vivo, com typewriter) -->
		{#if $aiIsStreaming && displayedStreamText}
			<div class="message assistant streaming">
				<div class="message-content">
					{@html renderMarkdown(stripStatusBlock(displayedStreamText))}{#if !isUpdatingStatus}<span class="cursor">▊</span>{/if}
				</div>
				{#if isUpdatingStatus}
					<div class="status-updating">
						<span class="status-dot"></span>
						<span class="status-dot"></span>
						<span class="status-dot"></span>
						Atualizando status do jogo...
					</div>
				{/if}
			</div>
		{/if}

		<!-- Debug: game status JSON atualizado -->
		{#if debugMode && !$aiIsStreaming && $aiMessages.length > 0}
			<div class="debug-block">
				<div class="debug-header">🐛 Game Status (debug)</div>
				<pre class="debug-json">{JSON.stringify($aiGameStatus, null, 2)}</pre>
			</div>
		{/if}

		<!-- Debug: raw streaming (mostra o JSON block antes de ser stripado) -->
		{#if debugMode && $aiIsStreaming && $aiStreamingContent}
			<div class="debug-block">
				<div class="debug-header">🐛 Raw stream</div>
				<pre class="debug-json">{$aiStreamingContent}</pre>
			</div>
		{/if}

		<!-- Indicador de carregamento (antes do primeiro token) -->
		{#if $aiIsLoading && !$aiStreamingContent}
			<div class="loading-indicator">
				<span class="dot">.</span><span class="dot">.</span><span class="dot">.</span>
			</div>
		{/if}
	</div>

	<!-- Banner de erro -->
	{#if $aiError}
		<div class="error-banner" transition:slide={{ duration: 150 }}>
			{$aiError}
		</div>
	{/if}

	<!-- Área de input -->
	<div class="input-area">
		<input
			type="text"
			bind:value={messageInput}
			on:keydown={handleMessageKeydown}
			placeholder={$isGameLoaded ? 'Pergunte algo sobre o jogo...' : 'Carregue um jogo primeiro...'}
			disabled={$aiIsLoading || !$isGameLoaded}
			class="message-input"
		/>
		<button
			class="btn-send"
			on:click={handleSendMessage}
			disabled={$aiIsLoading || !messageInput.trim() || !$isGameLoaded}
			title="Enviar mensagem"
		>
			↑
		</button>
	</div>
</div>

<style>
	.ai-assistant {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--bg-base);
	}

	/* ---- Cabeçalho ---- */
	.chat-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 1.5rem;
		background: var(--bg-elevated);
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
	}

	.chat-header h2 {
		margin: 0;
		font-size: 1rem;
		color: var(--accent);
		font-weight: 600;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.model-badge {
		font-size: 0.68rem;
		font-weight: 500;
		color: var(--text-faint);
		background: var(--btn-bg);
		padding: 0.15rem 0.5rem;
		border-radius: 999px;
		white-space: nowrap;
	}

	.model-badge.remote {
		color: var(--success-dim-text);
		background: var(--success-dim-bg);
	}

	.header-controls {
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

	.btn-icon.active {
		background: var(--accent-dim);
		outline: 1px solid var(--accent);
	}

	.btn-icon:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	/* ---- Debug ---- */
	.debug-block {
		margin: 0.5rem 0;
		border: 1px solid var(--accent);
		border-radius: 6px;
		overflow: hidden;
		opacity: 0.85;
	}

	.debug-header {
		background: var(--accent-dim);
		color: var(--accent);
		font-size: 0.72rem;
		font-weight: 700;
		padding: 0.25rem 0.6rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.debug-json {
		background: var(--bg-base);
		color: var(--text-secondary);
		font-family: 'Courier New', Courier, monospace;
		font-size: 0.72rem;
		line-height: 1.4;
		padding: 0.5rem 0.6rem;
		margin: 0;
		max-height: 240px;
		overflow-y: auto;
		white-space: pre-wrap;
		word-break: break-all;
	}

	/* ---- Toggle switch ---- */
	.settings-toggle {
		flex-direction: row !important;
		align-items: center;
		gap: 0.5rem !important;
	}

	.toggle-switch {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		cursor: pointer;
	}

	.toggle-switch input {
		accent-color: var(--accent);
		width: 16px;
		height: 16px;
		cursor: pointer;
	}

	.toggle-label {
		font-size: 0.78rem;
		color: var(--text-secondary);
	}

	/* ---- Painel de configurações ---- */
	.settings-panel {
		background: var(--bg-panel);
		border-bottom: 1px solid var(--border);
		padding: 0.75rem 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		flex-shrink: 0;
	}

	.settings-field {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.settings-field label {
		font-size: 0.75rem;
		color: var(--accent);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-weight: 600;
	}

	.settings-field select,
	.settings-field input {
		background: var(--bg-input);
		border: 1px solid var(--border-light);
		color: var(--text-primary);
		padding: 0.45rem 0.65rem;
		border-radius: 4px;
		font-size: 0.88rem;
		width: 100%;
	}

	.settings-field select:focus,
	.settings-field input:focus {
		outline: none;
		border-color: var(--accent);
	}

	.input-row {
		display: flex;
		gap: 0.4rem;
	}

	.input-row input {
		flex: 1;
	}

	.settings-hint {
		margin: 0.15rem 0 0;
		font-size: 0.75rem;
		color: var(--text-faint);
	}

	.settings-hint a {
		color: var(--accent);
		text-decoration: none;
	}

	.settings-hint a:hover {
		text-decoration: underline;
	}

	.loading-hint {
		font-size: 0.7rem;
		color: var(--text-faint);
		font-weight: 400;
		font-style: italic;
		text-transform: none;
		letter-spacing: normal;
	}

	/* ---- Painel de status do jogo ---- */
	.game-status-panel {
		background: var(--bg-panel);
		border-bottom: 1px solid var(--border);
		padding: 0.75rem 1.5rem;
		max-height: 260px;
		overflow-y: auto;
		flex-shrink: 0;
	}

	.status-section {
		margin-bottom: 0.75rem;
	}

	.status-section:last-child {
		margin-bottom: 0;
	}

	.status-section h4 {
		color: var(--accent);
		font-size: 0.82rem;
		margin: 0 0 0.2rem 0;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.status-section p {
		color: var(--text-primary);
		margin: 0;
		font-size: 0.88rem;
	}

	.status-section ul {
		margin: 0;
		padding-left: 1.2rem;
		color: var(--text-primary);
		font-size: 0.85rem;
	}

	.status-section li {
		margin-bottom: 0.15rem;
	}

	/* ---- Mapa inline ---- */
	.location-map-panel {
		border-bottom: 1px solid var(--border);
		max-height: 280px;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		flex-shrink: 0;
	}

	/* ---- Área de mensagens ---- */
	.messages-area {
		flex: 1;
		overflow-y: auto;
		padding: 1rem 1.25rem;
	}

	.messages-area::-webkit-scrollbar {
		width: 6px;
	}

	.messages-area::-webkit-scrollbar-track {
		background: var(--scrollbar-track);
	}

	.messages-area::-webkit-scrollbar-thumb {
		background: var(--scrollbar-thumb);
		border-radius: 4px;
	}

	/* ---- Estado vazio ---- */
	.empty-chat {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding: 2.5rem 1.5rem;
		color: var(--text-faint);
		gap: 0.75rem;
	}

	.empty-icon {
		font-size: 2.5rem;
		opacity: 0.4;
	}

	.empty-chat p {
		margin: 0;
		font-size: 0.9rem;
		color: var(--text-faint);
		max-width: 260px;
		line-height: 1.5;
	}

	.empty-hints {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		justify-content: center;
		margin-top: 0.25rem;
	}

	.empty-hints span {
		background: var(--hint-chip-bg);
		border: 1px solid var(--hint-chip-border);
		color: var(--hint-chip-text);
		font-size: 0.78rem;
		padding: 0.25rem 0.6rem;
		border-radius: 999px;
		font-style: italic;
		cursor: pointer;
		transition: background 0.15s, color 0.15s, border-color 0.15s;
	}

	.empty-hints span:hover {
		background: var(--bg-hover);
		border-color: var(--accent);
		color: var(--accent);
	}

	/* ---- Mensagens ---- */
	.message {
		margin-bottom: 0.75rem;
		padding: 0.65rem 0.9rem;
		border-radius: 8px;
		line-height: 1.55;
		word-wrap: break-word;
	}

	.message.user {
		background: var(--msg-user-bg);
		border-left: 3px solid var(--accent);
		margin-left: 1.5rem;
		color: var(--text-primary);
		white-space: pre-wrap;
		font-size: 0.92rem;
	}

	.message.assistant {
		background: var(--msg-assistant-bg);
		margin-right: 0.5rem;
		color: var(--text-primary);
		font-size: 0.92rem;
		border: 1px solid var(--msg-assistant-border);
	}

	.message.streaming {
		opacity: 0.95;
	}

	/* Estilos para conteúdo markdown renderizado nas mensagens do assistente */
	.message.assistant :global(strong) {
		color: var(--msg-strong);
		font-weight: 700;
	}

	.message.assistant :global(em) {
		color: var(--msg-em);
		font-style: italic;
	}

	.message.assistant :global(code) {
		background: var(--msg-code-bg);
		border: 1px solid var(--msg-code-border);
		padding: 0.1em 0.35em;
		border-radius: 3px;
		font-family: 'Courier New', Courier, monospace;
		font-size: 0.88em;
		color: var(--text-code);
	}

	.message.assistant :global(ul),
	.message.assistant :global(ol) {
		margin: 0.25rem 0;
		padding-left: 1.4rem;
	}

	.message.assistant :global(li) {
		margin-bottom: 0.2rem;
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

	/* ---- Indicador de atualização de status ---- */
	.status-updating {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		margin-top: 0.5rem;
		padding: 0.3rem 0.5rem;
		background: var(--success-dim-bg);
		border: 1px solid var(--success-border);
		border-radius: 4px;
		font-size: 0.78rem;
		color: var(--success-dim-text);
		font-style: italic;
	}

	.status-dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--success-dim-text);
		animation: statusPulse 1s infinite;
		flex-shrink: 0;
	}

	.status-dot:nth-child(2) { animation-delay: 0.2s; }
	.status-dot:nth-child(3) { animation-delay: 0.4s; }

	@keyframes statusPulse {
		0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
		40% { opacity: 1; transform: scale(1); }
	}

	/* ---- Loading ---- */
	.loading-indicator {
		text-align: center;
		padding: 0.75rem;
		color: var(--accent);
		font-size: 1.5rem;
		letter-spacing: 0.2em;
	}

	.dot {
		animation: dotPulse 1.2s infinite;
	}

	.dot:nth-child(2) { animation-delay: 0.2s; }
	.dot:nth-child(3) { animation-delay: 0.4s; }

	@keyframes dotPulse {
		0%, 80%, 100% { opacity: 0.3; }
		40% { opacity: 1; }
	}

	/* ---- Banner de erro ---- */
	.error-banner {
		background: var(--error-bg);
		color: var(--error-text);
		padding: 0.6rem 1.5rem;
		font-size: 0.88rem;
		border-top: 1px solid var(--error-border);
		flex-shrink: 0;
	}

	/* ---- Input ---- */
	.input-area {
		display: flex;
		gap: 0.5rem;
		padding: 0.75rem 1.25rem;
		background: var(--bg-elevated);
		border-top: 1px solid var(--border);
		flex-shrink: 0;
	}

	.message-input {
		flex: 1;
		background: var(--bg-input);
		border: 1px solid var(--border-light);
		padding: 0.65rem 1rem;
		font-size: 0.95rem;
		color: var(--text-primary);
		border-radius: 4px;
		transition: border-color 0.2s;
	}

	.message-input:focus {
		outline: none;
		border-color: var(--accent);
	}

	.message-input:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.btn-send {
		background: var(--accent);
		color: var(--accent-text-on);
		border: none;
		width: 40px;
		height: 40px;
		border-radius: 4px;
		font-size: 1.2rem;
		font-weight: 700;
		cursor: pointer;
		transition: background 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.btn-send:hover:not(:disabled) {
		background: var(--accent-hover);
	}

	.btn-send:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
</style>
