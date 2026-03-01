# Sessão 9 — 2026-03-01 — Temas, Providers, UX Polish, AI Memory Notes

## Sistema de Temas
- CSS custom properties no `:root` com `data-theme` no `<html>`, persistido em localStorage
- 4 temas: Dark Orange (default), Amber Terminal, Green Phosphor, Parchment
- Botão cycle no header, todos os componentes migrados para `var(--nome)`

## Sistema de Providers (Gemini Free Tier)
- `ProviderPreset` interface + `PROVIDER_PRESETS` em `claude.ts` — 5 presets (LM Studio, Gemini, OpenAI, OpenRouter, Personalizado)
- Endpoint Gemini é OpenAI-compatible: `generativelanguage.googleapis.com/v1beta/openai/chat/completions` (free tier: 250 req/dia)
- `sendToAIStreaming` parametrizado com `model` (antes hardcoded `'local-model'`)
- `aiChat.ts`: estado de provider (`providerId`, `apiUrl`, `model`), `setProvider()`, persistência localStorage
- UI: painel ⚙️ no AIAssistant com dropdown de provider, API key, modelo, URL custom
- Badge no header mostrando modelo + local/remoto

## Debug Mode
- Toggle debug ON/OFF no painel de configurações
- Mostra AI memory após cada resposta da IA
- Mostra raw stream durante streaming

## Efeito Typewriter
- GamePanel: output do jogo revelado gradualmente (4 chars/frame) com cursor ▊ piscante
- AIAssistant: streaming revelado via `requestAnimationFrame` (3 chars/frame), independente do tamanho dos chunks
- Comandos (`>`) e loads em massa aparecem instantaneamente

## Correções de Streaming (Gemini)
- `max_tokens: 1024 → 2048` — evita cortar o bloco de memória
- Parser SSE com buffer de linhas incompletas — Gemini pode dividir uma `data:` line entre chunks

## Correções de Scroll
- GamePanel: auto-scroll só quando o usuário já está no fundo (margem 60px)
- Typewriter scrolla a cada frame durante a animação
- `prevOutputLength` reseta quando gameHistory encolhe (restart/new game)

## Correções de Save/Load/Restart (Race Conditions)
- `SaveSlot` agora inclui `aiChatMessages` — save/load preserva o chat da IA completo
- Restart: `resetAIStateForRestart()` roda ANTES de `restartGame()` com `await`
- Restart: `restartGame()` não seta mais `isLoaded = false` — evita unmount/remount dos componentes
- Load: `restoreAIMemoryFromSave()` persiste no IndexedDB ANTES de `loadFromSaveSlot()` — evita race condition com reactive `loadAIStateForGame`
- Novo jogo (upload): limpa IndexedDB via `clearGameAIData()` antes de carregar

## Limpeza do Repositório
- `.claude/`, `_bmad/`, `bkp/`, `coverage/` adicionados ao `.gitignore`
- `git-filter-repo` removeu 319 arquivos desses diretórios de todo o histórico (33 commits reescritos)

## OpenRouter como 5º Provider
- Preset adicionado em `claude.ts` — endpoint `openrouter.ai/api/v1`, modelo default `google/gemma-3-27b-it:free`

## Dropdown Dinâmico de Modelos
- `fetchAvailableModels()` em `claude.ts` — busca modelos da API do provider em tempo real
- Gemini: `GET /v1beta/models?key=` filtra por `generateContent`
- OpenRouter: `GET /api/v1/models` filtra por `:free`
- UI: dropdown `<select>` quando há modelos disponíveis, input texto quando não há

## Gemma 3 27B como Default do Gemini
- Trocado de `gemini-2.5-flash` para `gemma-3-27b-it` — quota diária muito maior (~14k vs 250 RPD)
- Gemma não suporta `system` role — código detecta modelo gemma e injeta system prompt como user/assistant

## AI Memory Notes (substituição do GameStatus JSON)
- Substituído `GameStatus` (7 campos, JSON aninhado) por `AIMemory = string[]` (lista de notas)
- Removidos `tryRepairAndParseJSON()`, 4 regex patterns de parsing, `LocalVisitado` type
- Criado `applyMemoryOperations()` — processa ADD/REMOVE/UPDATE sequencialmente (máx 20 notas)
- `parseAIResponse()` reescrito com 1 regex (`MEMORY_UPDATE_START/END`)
- System prompt reescrito: lista numerada de notas + instruções de operações (~25 linhas vs ~40)
- Removido `LocationMap.svelte` (215 linhas) e terceira coluna do layout
- Removidos `locationMapExpanded` store, botão 🗺️, painel de status (5 seções)
- Adicionado painel 📝 "Anotações da IA" com `<ol>` numerada no AIAssistant
- `SaveSlot.aiGameStatus` → `SaveSlot.aiMemory: AIMemory`
- `restoreAIStatusFromSave()` → `restoreAIMemoryFromSave()`
- Saldo: **-374 linhas** (11 arquivos, 422 inserções / 796 remoções)
- **Motivação:** modelos menores falhavam com JSON estruturado; operações baseadas em texto são robustas

## Resultado
✅ Build OK, 182 testes passando, 99%+ coverage.
