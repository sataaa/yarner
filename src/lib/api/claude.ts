/**
 * AI API Client — OpenAI-compatible API communication
 *
 * Supports both local LLM servers (LM Studio, Ollama) and cloud APIs
 * (Anthropic, OpenAI) through the OpenAI chat/completions format.
 *
 * Default: connects to LM Studio at localhost:55511
 *
 * Response format: The AI returns a natural language message followed by a
 * fenced JSON block (```game-status ... ```) containing the updated game status.
 * The parser separates these two parts.
 */

import type { GameStatus } from '../stores/aiPersistence';

/** Default endpoint for local LM Studio server (browser connects directly) */
const DEFAULT_API_URL = 'http://localhost:55511/v1/chat/completions';

/** Parsed AI response: visible chat message + structured game status update */
export interface AIResponse {
	message: string;
	updatedGameStatus: GameStatus;
}

/** Callback invoked during streaming with the accumulated text so far */
export type StreamCallback = (partialText: string) => void;

/**
 * Send a message to the AI with streaming response via OpenAI-compatible API.
 *
 * Works with LM Studio, Ollama, OpenAI, or any OpenAI-compatible endpoint.
 *
 * @param apiKey - API key (optional for local servers like LM Studio)
 * @param conversationHistory - Previous messages in the chat (user + assistant)
 * @param gameHistoryDiff - New game output since last AI interaction
 * @param currentGameStatus - Current structured game status
 * @param gameName - Name of the game being played
 * @param onStream - Callback for streaming partial responses
 * @param apiUrl - Override the API endpoint URL
 * @returns Parsed response with chat message and updated game status
 */
export async function sendToAIStreaming(
	apiKey: string,
	conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
	gameHistoryDiff: string,
	currentGameStatus: GameStatus,
	gameName: string,
	onStream: StreamCallback,
	apiUrl: string = DEFAULT_API_URL
): Promise<AIResponse> {
	const systemPrompt = buildSystemPrompt(gameName, currentGameStatus, gameHistoryDiff);

	// Build messages array in OpenAI chat format
	const messages = [
		{ role: 'system', content: systemPrompt },
		...conversationHistory
	];

	// Build request body
	const requestBody = {
		model: 'local-model',
		messages,
		stream: true,
		max_tokens: 1024,
		temperature: 0.7
	};

	const response = await fetch(apiUrl, {
		method: 'POST',
		mode: 'cors',
		headers: {
			'Content-Type': 'application/json',
			...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {})
		},
		body: JSON.stringify(requestBody)
	});

	if (!response.ok) {
		const errorText = await response.text().catch(() => '');
		throw new Error(`API error (${response.status}): ${errorText || response.statusText}`);
	}

	if (!response.body) {
		throw new Error('No response body received from AI server');
	}

	// Process the SSE (Server-Sent Events) stream
	let fullResponse = '';
	const reader = response.body.getReader();
	const decoder = new TextDecoder();

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			const chunk = decoder.decode(value, { stream: true });
			const lines = chunk.split('\n');

			for (const line of lines) {
				const trimmed = line.trim();
				if (!trimmed || !trimmed.startsWith('data: ')) continue;

				const data = trimmed.slice(6); // Remove 'data: ' prefix
				if (data === '[DONE]') continue;

				try {
					const parsed = JSON.parse(data);
					const delta = parsed.choices?.[0]?.delta?.content;
					if (delta) {
						fullResponse += delta;
						onStream(fullResponse);
					}
				} catch {
					// Skip malformed JSON lines (common in SSE streams)
				}
			}
		}
	} finally {
		reader.releaseLock();
	}

	return parseAIResponse(fullResponse, currentGameStatus);
}

/**
 * Build the system prompt that gives the AI all the context it needs.
 *
 * The prompt instructs the AI to:
 * 1. Act as a helpful text adventure assistant (in PT-BR)
 * 2. Analyze the game output diff
 * 3. Return an updated game status JSON block at the end of each response
 */
function buildSystemPrompt(
	gameName: string,
	gameStatus: GameStatus,
	gameHistoryDiff: string
): string {
	return `Voce e um assistente para jogos de aventura em texto (interactive fiction). O jogador esta jogando "${gameName}".

Seu papel:
- Ajudar o jogador quando ele pedir dicas ou sugestoes
- Analisar a saida do jogo e manter um status atualizado do progresso
- Responder em portugues do Brasil
- Ser conciso e util, sem dar spoilers desnecessarios
- Sugerir comandos validos do jogo quando apropriado (look, examine, go north, take, etc.)
- Se o jogador perguntar algo generico, use o status do jogo como contexto

CONTEXTO DO JOGO - Novidades desde a ultima interacao:
${gameHistoryDiff || '(nenhuma novidade no jogo ainda)'}

STATUS ATUAL DO JOGO (mantido por voce):
${JSON.stringify(gameStatus, null, 2)}

INSTRUCAO IMPORTANTE: Ao final de CADA resposta, inclua EXATAMENTE este bloco (sem mudar o formato):

GAME_STATUS_JSON_START
{"localizacaoAtual":"descricao do local atual","inventario":["item1","item2"],"objetivos":["objetivo1","objetivo2"],"coisasNaoExploradas":["algo mencionado mas nao examinado"],"observacoes":["notas uteis sobre o jogo"]}
GAME_STATUS_JSON_END

Regras do bloco de status:
- Use GAME_STATUS_JSON_START e GAME_STATUS_JSON_END como delimitadores (NAO use crases/backticks)
- O JSON deve estar em UMA UNICA LINHA entre os delimitadores
- Atualize os campos baseado no contexto do jogo
- Se nada mudou, retorne o status anterior sem alteracoes
- SEMPRE inclua o bloco ao final da resposta`;
}

/**
 * Parse AI response to extract the visible message and the game status JSON.
 *
 * The AI appends a ```game-status ... ``` block at the end. We extract it,
 * parse the JSON, and return the clean message separately.
 */
function parseAIResponse(fullText: string, fallbackStatus: GameStatus): AIResponse {
	// Try multiple patterns that LLMs might use for the status block
	const patterns = [
		/GAME_STATUS_JSON_START\s*([\s\S]*?)\s*GAME_STATUS_JSON_END/,
		/```game-status\s*\n([\s\S]*?)\n```/,
		/```json\s*\n([\s\S]*?)\n```\s*$/,
		/```\s*\n(\{[\s\S]*?"localizacaoAtual"[\s\S]*?\})\s*\n```/
	];

	let updatedGameStatus = fallbackStatus;
	let message = fullText;

	for (const regex of patterns) {
		const match = fullText.match(regex);
		if (match) {
			try {
				const parsed = JSON.parse(match[1].trim());
				// Validate it looks like a game status (has at least one expected field)
				if (parsed.localizacaoAtual !== undefined || parsed.inventario !== undefined) {
					updatedGameStatus = {
						...fallbackStatus,
						...parsed,
						ultimaAtualizacao: new Date().toISOString()
					};
					message = fullText.replace(regex, '').trim();
					break;
				}
			} catch (e) {
				console.warn('Failed to parse game status from AI response:', e);
			}
		}
	}

	return { message, updatedGameStatus };
}

/**
 * Translate API errors to user-friendly Portuguese messages.
 */
export function getErrorMessage(error: unknown): string {
	if (error instanceof TypeError && (error as Error).message.includes('fetch')) {
		return 'Nao foi possivel conectar ao servidor de IA. Verifique se o servidor esta rodando.';
	}
	if (error instanceof Error) {
		if (error.message.includes('401')) {
			return 'Chave de API invalida. Verifique sua chave e tente novamente.';
		}
		if (error.message.includes('429')) {
			return 'Limite de requisicoes atingido. Aguarde um momento e tente novamente.';
		}
		return `Erro: ${error.message}`;
	}
	return 'Erro desconhecido ao se comunicar com a IA.';
}
