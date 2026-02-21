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
	apiUrl: string = DEFAULT_API_URL,
	signal?: AbortSignal
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
		body: JSON.stringify(requestBody),
		signal
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

INSTRUCAO IMPORTANTE: Ao final de CADA resposta, adicione EXATAMENTE este bloco. NAO mencione o bloco nem fale sobre ele na sua resposta visivel — apenas inclua-o em silencio ao final:

GAME_STATUS_JSON_START
{"localizacaoAtual":"nome exato do local atual","inventario":["item1","item2"],"objetivos":["obj1"],"coisasNaoExploradas":["algo nao examinado"],"observacoes":["nota util"],"locaisVisitados":{}}
GAME_STATUS_JSON_END

Regras obrigatorias:
- NAO escreva "O status do jogo agora e:" nem qualquer introducao antes do bloco
- Use GAME_STATUS_JSON_START e GAME_STATUS_JSON_END como delimitadores (NAO use crases)
- O JSON em UMA UNICA LINHA entre os delimitadores
- Atualize localizacaoAtual com o nome real do local onde o jogador esta agora
- SEMPRE inclua o bloco ao final de cada resposta

Regras para o campo locaisVisitados:
- Para cada local visitado, adicione uma entrada. Exemplo de formato:
  "West of House": {"saidas": {"north": "nao explorado", "east": "nao explorado"}, "notas": ["mailbox aqui"]}
- saidas: mapeie direcoes para o nome do destino (se ja visitado) ou "nao explorado"
- notas: itens no chao, portas trancadas, estados importantes do local
- NUNCA remova locais ja registrados no status atual — apenas adicione ou atualize`;

}

/**
 * Parse AI response to extract the visible message and the game status JSON.
 *
 * The AI appends a GAME_STATUS_JSON_START...GAME_STATUS_JSON_END block at the end.
 * We extract it, parse the JSON, and return the clean message separately.
 *
 * The block is ALWAYS stripped from the visible message, even if JSON parsing fails,
 * so the user never sees raw JSON in the chat.
 */
/** @internal Exported for unit testing */
export function parseAIResponse(fullText: string, fallbackStatus: GameStatus): AIResponse {
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
			// Sempre remove o bloco da mensagem visível, independente de parsing
			message = fullText.replace(regex, '').trim();

			const parsed = tryRepairAndParseJSON(match[1].trim());
			if (parsed && (parsed.localizacaoAtual !== undefined || parsed.inventario !== undefined)) {
				updatedGameStatus = {
					...fallbackStatus,
					...parsed,
					// Merge locaisVisitados additivamente — nunca apaga dados existentes
					locaisVisitados: {
						...fallbackStatus.locaisVisitados,
						...(parsed.locaisVisitados || {})
					},
					ultimaAtualizacao: new Date().toISOString()
				};
			}
			break;
		}
	}

	return { message, updatedGameStatus };
}

/**
 * Tenta fazer parse de um JSON, e se falhar, tenta reparar fechando chaves/colchetes
 * abertos (modelos pequenos às vezes truncam o JSON no final).
 */
/** @internal Exported for unit testing */
export function tryRepairAndParseJSON(s: string): Record<string, unknown> | null {
	// Tenta primeiro como está
	try { return JSON.parse(s); } catch {}

	// Conta chaves e colchetes não fechados para reparar JSON truncado
	let braces = 0, brackets = 0;
	let inStr = false, esc = false;
	for (const ch of s) {
		if (esc) { esc = false; continue; }
		if (ch === '\\' && inStr) { esc = true; continue; }
		if (ch === '"') { inStr = !inStr; continue; }
		if (inStr) continue;
		/* v8 ignore start */
		if (ch === '{') braces++;
		else if (ch === '}') braces = Math.max(0, braces - 1);
		else if (ch === '[') brackets++;
		else if (ch === ']') brackets = Math.max(0, brackets - 1);
		/* v8 ignore stop */
	}

	const repaired = s + ']'.repeat(brackets) + '}'.repeat(braces);
	try {
		const result = JSON.parse(repaired);
		console.info('Repaired truncated JSON from AI response');
		return result;
	} catch {}

	console.warn('Failed to parse game status JSON even after repair attempt');
	return null;
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
