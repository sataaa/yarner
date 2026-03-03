# Sessão 4 — 2026-02-16 — Épico 2: Assistente IA

**Pivô de API:** SDK Anthropic → API OpenAI-compatible via `fetch` (sem SDK, sem serverless).

**Bug Principal:** CORS entre browser (Windows) e LM Studio (Windows localhost:55511). Solução: habilitar CORS nas configurações do LM Studio.

**Arquivos criados:**
- `src/lib/stores/aiPersistence.ts` — IndexedDB (game status + chat por jogo)
- `src/lib/api/claude.ts` — cliente OpenAI-compatible com streaming SSE
- `src/lib/stores/aiChat.ts` — store central do AI chat
- `src/lib/components/AIAssistant.svelte` — interface de chat

**Lições:** Modelos 8B não seguem formatos com backticks; delimitadores texto simples funcionam. Game status como memória é mais eficiente que guardar todo o log.

**Épico 2 ✅ COMPLETO E TESTADO.**
