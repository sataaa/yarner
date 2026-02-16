<script lang="ts">
	/**
	 * AIAssistant — Chat interface for the AI game assistant.
	 *
	 * Connects to an OpenAI-compatible API (LM Studio, Ollama, OpenAI, etc.)
	 * Shows chat interface directly — no API key required for local servers.
	 */
	import { onMount } from 'svelte';
	import {
		aiMessages,
		aiGameStatus,
		aiIsLoading,
		aiIsStreaming,
		aiStreamingContent,
		aiError,
		aiChat
	} from '$lib/stores/aiChat';
	import { isGameLoaded, currentGameName } from '$lib/stores/gameState';

	let messageInput = '';
	let messagesContainer: HTMLDivElement;
	let showGameStatus = false;

	// Initialize AI chat on mount
	onMount(() => {
		aiChat.initAIChat();
	});

	// Load persisted AI state when game changes
	$: if ($isGameLoaded && $currentGameName) {
		aiChat.loadAIStateForGame($currentGameName);
	}

	// Auto-scroll on new messages or streaming updates
	$: if (($aiMessages.length > 0 || $aiStreamingContent) && messagesContainer) {
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
	 * Strip the game-status JSON block from streaming content for live display.
	 * The block appears at the end of the response and shouldn't be shown to the user.
	 */
	function stripStatusBlock(text: string): string {
		return text
			.replace(/GAME_STATUS_JSON_START[\s\S]*$/m, '')
			.replace(/```game-status[\s\S]*$/m, '')
			.replace(/```json\s*\n\{[\s\S]*$/m, '')
			.trim();
	}
</script>

<div class="ai-assistant">
	<!-- Chat Header -->
	<div class="chat-header">
		<h2>Assistente IA</h2>
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
				on:click={() => aiChat.clearChatMessages()}
				title="Limpar chat (mantém status do jogo)"
				disabled={$aiMessages.length === 0}
			>
				🗑️
			</button>
		</div>
	</div>

	<!-- Game Status Panel (collapsible) -->
	{#if showGameStatus}
		<div class="game-status-panel">
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

	<!-- Messages Area -->
	<div class="messages-area" bind:this={messagesContainer}>
		{#if $aiMessages.length === 0 && !$aiIsStreaming}
			<div class="empty-chat">
				<p>Jogue um pouco e depois me pergunte qualquer coisa sobre o jogo!</p>
				<p class="hint">Exemplos: "onde estou?", "o que devo fazer?", "que itens tenho?"</p>
			</div>
		{/if}

		{#each $aiMessages as msg}
			<div class="message {msg.role}">
				<div class="message-content">
					{msg.content}
				</div>
			</div>
		{/each}

		<!-- Streaming response (live) -->
		{#if $aiIsStreaming && $aiStreamingContent}
			<div class="message assistant streaming">
				<div class="message-content">
					{stripStatusBlock($aiStreamingContent)}<span class="cursor">▊</span>
				</div>
			</div>
		{/if}

		<!-- Loading indicator -->
		{#if $aiIsLoading && !$aiStreamingContent}
			<div class="loading-indicator">
				<span class="dot">.</span><span class="dot">.</span><span class="dot">.</span>
			</div>
		{/if}
	</div>

	<!-- Error Banner -->
	{#if $aiError}
		<div class="error-banner">
			{$aiError}
		</div>
	{/if}

	<!-- Input Area -->
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
		background: #1a1a1a;
	}

	/* ---- Chat Header ---- */
	.chat-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 1.5rem;
		background: #2a2a2a;
		border-bottom: 1px solid #3a3a3a;
	}

	.chat-header h2 {
		margin: 0;
		font-size: 1.2rem;
		color: #ffa500;
	}

	.header-controls {
		display: flex;
		gap: 0.5rem;
	}

	.btn-icon {
		background: #3a3a3a;
		border: none;
		padding: 0.5rem;
		border-radius: 4px;
		cursor: pointer;
		font-size: 1.1rem;
		transition: background 0.3s;
	}

	.btn-icon:hover {
		background: #4a4a4a;
	}

	.btn-icon.active {
		background: #ffa500;
	}

	/* ---- Game Status Panel ---- */
	.game-status-panel {
		background: #222;
		border-bottom: 1px solid #3a3a3a;
		padding: 1rem 1.5rem;
		max-height: 250px;
		overflow-y: auto;
	}

	.status-section {
		margin-bottom: 0.75rem;
	}

	.status-section:last-child {
		margin-bottom: 0;
	}

	.status-section h4 {
		color: #ffa500;
		font-size: 0.85rem;
		margin: 0 0 0.25rem 0;
	}

	.status-section p {
		color: #e0e0e0;
		margin: 0;
		font-size: 0.9rem;
	}

	.status-section ul {
		margin: 0;
		padding-left: 1.2rem;
		color: #e0e0e0;
		font-size: 0.85rem;
	}

	.status-section li {
		margin-bottom: 0.15rem;
	}

	/* ---- Messages Area ---- */
	.messages-area {
		flex: 1;
		overflow-y: auto;
		padding: 1rem 1.5rem;
	}

	.messages-area::-webkit-scrollbar {
		width: 8px;
	}

	.messages-area::-webkit-scrollbar-track {
		background: #2a2a2a;
	}

	.messages-area::-webkit-scrollbar-thumb {
		background: #4a4a4a;
		border-radius: 4px;
	}

	.empty-chat {
		text-align: center;
		padding: 2rem 1rem;
		color: #888;
	}

	.empty-chat p {
		margin: 0.5rem 0;
	}

	.hint {
		font-size: 0.85rem;
		font-style: italic;
		color: #666;
	}

	.message {
		margin-bottom: 1rem;
		padding: 0.75rem 1rem;
		border-radius: 8px;
		line-height: 1.5;
		white-space: pre-wrap;
		word-wrap: break-word;
	}

	.message.user {
		background: #2a2a2a;
		border-left: 3px solid #ffa500;
		margin-left: 2rem;
		color: #e0e0e0;
	}

	.message.assistant {
		background: #252525;
		margin-right: 2rem;
		color: #e0e0e0;
	}

	.message.streaming {
		opacity: 0.9;
	}

	.cursor {
		animation: blink 0.8s infinite;
		color: #ffa500;
	}

	@keyframes blink {
		0%,
		50% {
			opacity: 1;
		}
		51%,
		100% {
			opacity: 0;
		}
	}

	/* ---- Loading Indicator ---- */
	.loading-indicator {
		text-align: center;
		padding: 1rem;
		color: #ffa500;
		font-size: 1.5rem;
	}

	.dot {
		animation: dotPulse 1.2s infinite;
	}

	.dot:nth-child(2) {
		animation-delay: 0.2s;
	}

	.dot:nth-child(3) {
		animation-delay: 0.4s;
	}

	@keyframes dotPulse {
		0%,
		80%,
		100% {
			opacity: 0.3;
		}
		40% {
			opacity: 1;
		}
	}

	/* ---- Error Banner ---- */
	.error-banner {
		background: #442222;
		color: #ff6666;
		padding: 0.75rem 1.5rem;
		font-size: 0.9rem;
		border-top: 1px solid #663333;
	}

	/* ---- Input Area ---- */
	.input-area {
		display: flex;
		gap: 0.5rem;
		padding: 1rem 1.5rem;
		background: #2a2a2a;
		border-top: 1px solid #3a3a3a;
	}

	.message-input {
		flex: 1;
		background: #1e1e1e;
		border: 1px solid #4a4a4a;
		padding: 0.75rem 1rem;
		font-size: 1rem;
		color: #e0e0e0;
		border-radius: 4px;
		transition: border-color 0.3s;
	}

	.message-input:focus {
		outline: none;
		border-color: #ffa500;
	}

	.message-input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-send {
		background: #ffa500;
		color: #1a1a1a;
		border: none;
		width: 42px;
		height: 42px;
		border-radius: 4px;
		font-size: 1.3rem;
		font-weight: 700;
		cursor: pointer;
		transition: background 0.3s;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.btn-send:hover:not(:disabled) {
		background: #ffb733;
	}

	.btn-send:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
