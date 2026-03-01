# MEMÓRIA DO PROJETO YARNER

> **PROPÓSITO:** Este arquivo contém o histórico completo de decisões, contexto e conhecimento acumulado do projeto. Deve ser consultado sempre e atualizado com qualquer mudança significativa.

---

## 📋 INFORMAÇÕES BÁSICAS

- **Nome do Projeto:** Yarner ("One who tells yarns/stories" + jogador)
- **Owner:** Godoy
- **Data de Início:** 2026-02-11
- **Status Atual:** Épicos 1, 2, 3 ✅ COMPLETOS — Épico 4 em andamento
- **Linguagem de Comunicação:** Português Brasileiro

---

## 🎯 VISÃO E CONCEITO

Interface web para jogar text adventures (Z-machine) com um assistente de IA ao lado. Split-view: esquerda = jogo (ifvms.js + WebGlk custom), direita = chat IA. A IA lê o output do jogo em tempo real, mantém um "game status" estruturado (localização, inventário, objetivos, mapa de locais) e ajuda o jogador quando solicitado.

---

## 🏗️ DECISÕES DE ARQUITETURA

### Decisão 1: Web-First ao invés de Desktop

**Decisão:** SPA (SvelteKit + adapter-static) ao invés de Electron.

**Razão:** Zero friction, sem instalação, viral potential, deploy gratuito (Vercel/Netlify), updates instantâneos, multiplataforma automático.

---

### Decisão 2: Stack Tecnológica

- **Frontend:** SvelteKit (adapter-static, SPA mode) + TypeScript
- **Z-Machine:** ifvms.js (não Parchment.js — sem API programática) + WebGlk custom
- **Armazenamento:** IndexedDB via `idb` (DB v2: `gameStatus`, `chatHistory`, `gameSaves`)
- **API de IA:** OpenAI-compatible — funciona com LM Studio, Ollama, OpenAI, Claude, etc.

---

### Decisão 3: Escopo MVP

Apenas Z-machine (.z3, .z4, .z5, .z8). Sem Glulx, sem multiplayer, sem backend complexo. API key fornecida pelo usuário, chamada direto do browser (sem serverless proxy no MVP).

---

### Decisão 4: Game Status como Memória Persistente

A IA mantém um JSON estruturado (`GameStatus`) com localização, inventário, objetivos, `locaisVisitados` e observações. Persiste em IndexedDB por jogo. Serve como memória entre sessões — não precisa reenviar o log inteiro.

Delimitadores: `GAME_STATUS_JSON_START` / `GAME_STATUS_JSON_END` (backticks não funcionam bem com modelos 8B). Parser com 4 padrões de fallback. Merge aditivo em `locaisVisitados` (nunca apaga dados existentes).

---

## 🔄 HISTÓRICO DE SESSÕES

### Sessões 1–3 (2026-02-11 a 2026-02-16) — Setup e Épico 1

**Sessão 1:** Brainstorm, nome Yarner, stack web-first, MANDAMENTOS.md, MEMORIA-PROJETO.md, init SvelteKit.

**Sessão 2:** Épico 1 — Parchment.js não tem API programática → mudança para ifvms.js. Criação do WebGlk custom, FileUploader, GamePanel, gameState store. Implementado mas não testado.

**Sessão 3:** Épico 1 validado com Zork I. Bugs corrigidos: `new ZVM()` (não `Object.create`), WebGlk reescrito com ~60 métodos Glk, callback de output registrado antes de `loadGame()`, GamePanel usando store como fonte única de verdade, layout scroll correto. **Épico 1 ✅ COMPLETO.**

---

### Sessão 4: 2026-02-16 — Épico 2: Assistente IA

**Pivô de API:** SDK Anthropic → API OpenAI-compatible via `fetch` (sem SDK, sem serverless).

**Bug Principal:** CORS entre browser (Windows) e LM Studio (Windows localhost:55511). Solução: habilitar CORS nas configurações do LM Studio.

**Arquivos criados:**
- `src/lib/stores/aiPersistence.ts` — IndexedDB (game status + chat por jogo)
- `src/lib/api/claude.ts` — cliente OpenAI-compatible com streaming SSE
- `src/lib/stores/aiChat.ts` — store central do AI chat
- `src/lib/components/AIAssistant.svelte` — interface de chat

**Lições:** Modelos 8B não seguem formatos com backticks; delimitadores texto simples funcionam. Game status como memória é mais eficiente que guardar todo o log.

**Resultado:** Épico 2 ✅ COMPLETO E TESTADO.

---

### Sessão 5: 2026-02-18 — Épico 3: Mapa de Locais

**Design:** `locaisVisitados` é campo novo no `GameStatus` existente (zero sistema paralelo). Schema: `"north": "Forest Path"` (explorado) ou `"north": "nao explorado"`. UI: botão 🗺️ inline + terceira coluna expansível (320px, store `locationMapExpanded`).

**Bugs corrigidos:**
1. Modelo 8B vazando status na resposta visível → instrução explícita no prompt
2. `locaisVisitados` sobrescrito com `{}` → merge aditivo: `{ ...fallbackStatus.locaisVisitados, ...(parsed.locaisVisitados || {}) }`

**Limitação conhecida:** Modelos 8B têm dificuldade com JSON aninhado de `locaisVisitados`. Modelos maiores (70B+) funcionam muito melhor.

**Resultado:** Épico 3 ✅ COMPLETO.

---

### Sessão 6: 2026-02-18 — Épico 4: Save/Load

**Abordagem:** Save externo via `do_autosave`/`do_autorestore` do ifvms.js (botões externos, sem usar o comando "save" do jogo).

**Detalhe crítico:** Após `do_autorestore`, o VM não re-executa `glk_request_line_event_uni`, então `pendingInputBuffer` fica null. Fix: `glk.pendingInputBuffer = vm.read_data.buffer` manualmente. Também necessário: `win.linebuf = buffer` em `glk_request_line_event_uni` para que o `do_autorestore` encontre o buffer.

**`gameData`** (ArrayBuffer do .z5) é salvo no slot para restore cross-session sem o usuário recarregar o arquivo.

**Resultado:** ✅ Testado com Zork I. Save e Load funcionando.

---

### Sessão 7: 2026-02-18 — UI/UX Polish

1. Textos PT-BR em todos os componentes
2. Drag-and-drop no FileUploader (feedback visual com borda laranja)
3. Confirmações inline (sem `confirm()` nativo) em 3 lugares do GamePanel
4. Markdown nas respostas da IA — `renderMarkdown()` com sanitização XSS (escapa HTML antes de transformar)
5. Transições `svelte/transition:slide` nos painéis
6. Header global compacto (barra fina horizontal)
7. Estado vazio do chat com chips de exemplo clicáveis

---

### Sessão 8: 2026-02-21 — Testes, CI e Refatoração

**PR 4 — README reescrito:**
- Removidas todas as referências ao Parchment.js
- Diagrama Mermaid substituindo o ASCII box diagram
- Documentação da arquitetura real (v0.4.0-alpha): ifvms.js, OpenAI-compatible, game status como memória, merge aditivo, save slots com estado da IA

**PR 5 — Testes unitários + CI:**
- **40 testes unitários** em 3 arquivos:
  - `claude.ts` — parser do GameStatus (4 padrões de delimitadores, merge aditivo, repair de JSON truncado)
  - `aiPersistence.ts` — round-trip IndexedDB, CRUD completo de save slots
  - `gameState.ts` — estado inicial, `addOutput`, `clearHistory`, guards de save/load
- **GitHub Actions CI** — bloqueia merge se build ou testes falharem; coverage mínimo enforced: 95%
- BMAD instalado no projeto (agent-manifest, workflows, comandos `.claude/`)

**PR 6 — Refatoração zvm-wrapper → módulos testáveis:**
- `zvm-wrapper.ts` deletado (829 linhas)
- `src/lib/zmachine/glk/types.ts` — tipos compartilhados (GlkRefStruct, GlkRefBox, GlkWindow, GlkStream)
- `src/lib/zmachine/glk/WebGlk.ts` — adaptador Glk **sem dependência do ZVM** (testável em Node.js)
- `src/lib/zmachine/glk/WebGlk.test.ts` — 76 novos testes unitários do WebGlk
- `src/lib/zmachine/GameEngine.ts` — ciclo de vida do VM (load, command, save, restore)
- `src/lib/zmachine/index.ts` — re-export público (`createGameEngine`, `GameEngine`)
- **159 testes passando, 98.34% branch coverage global; `WebGlk.ts` e `types.ts` em 100%**

---

### Sessão 9: 2026-03-01 — Temas, Providers, UX Polish

**Sistema de Temas:**
- CSS custom properties no `:root` com `data-theme` no `<html>`, persistido em localStorage
- 4 temas: Dark Orange (default), Amber Terminal, Green Phosphor, Parchment
- Botão cycle no header, todos os componentes migrados para `var(--nome)`

**Sistema de Providers (Gemini Free Tier):**
- `ProviderPreset` interface + `PROVIDER_PRESETS` em `claude.ts` — 4 presets (LM Studio, Gemini, OpenAI, Personalizado)
- Endpoint Gemini é OpenAI-compatible: `generativelanguage.googleapis.com/v1beta/openai/chat/completions` (free tier: 250 req/dia)
- `sendToAIStreaming` parametrizado com `model` (antes hardcoded `'local-model'`)
- `aiChat.ts`: estado de provider (`providerId`, `apiUrl`, `model`), `setProvider()`, persistência localStorage
- UI: painel ⚙️ no AIAssistant com dropdown de provider, API key, modelo, URL custom
- Badge no header mostrando modelo + local/remoto

**Debug Mode:**
- Toggle debug ON/OFF no painel de configurações
- Mostra JSON do game status após cada resposta da IA
- Mostra raw stream durante streaming (inclui bloco GAME_STATUS_JSON antes de ser stripado)

**Efeito Typewriter:**
- GamePanel: output do jogo revelado gradualmente (4 chars/frame) com cursor ▊ piscante
- AIAssistant: streaming revelado via `requestAnimationFrame` (3 chars/frame), independente do tamanho dos chunks
- Comandos (`>`) e loads em massa aparecem instantaneamente

**Correções de Streaming (Gemini):**
- `max_tokens: 1024 → 2048` — evita cortar o JSON de game status
- Parser SSE com buffer de linhas incompletas — Gemini pode dividir uma `data:` line entre chunks

**Correções de Scroll:**
- GamePanel: auto-scroll só quando o usuário já está no fundo (margem 60px)
- Typewriter scrolla a cada frame durante a animação
- `prevOutputLength` reseta quando gameHistory encolhe (restart/new game)

**Correções de Save/Load/Restart:**
- `SaveSlot` agora inclui `aiChatMessages` — save/load preserva o chat da IA completo
- Restart: `resetAIStateForRestart()` roda ANTES de `restartGame()` com `await`
- Restart: `restartGame()` não seta mais `isLoaded = false` — evita unmount/remount dos componentes
- Load: `restoreAIStatusFromSave()` persiste no IndexedDB ANTES de `loadFromSaveSlot()` — evita race condition com reactive `loadAIStateForGame`
- Novo jogo (upload): limpa IndexedDB via `clearGameAIData()` antes de carregar

**Resultado:** ✅ Build OK, 166 testes passando, 98.35% branch coverage.

**Limpeza do Repositório:**
- `.claude/`, `_bmad/`, `bkp/`, `coverage/` adicionados ao `.gitignore`
- `git-filter-repo` removeu 319 arquivos desses diretórios de todo o histórico (33 commits reescritos)
- Force push no main — repositório limpo retroativamente

**OpenRouter como 5º Provider:**
- Preset adicionado em `claude.ts` — endpoint `openrouter.ai/api/v1`, modelo default `google/gemma-3-27b-it:free`
- Free tier compartilhado: modelos podem retornar 429 em horários de pico (depende de providers upstream como Venice)

**Dropdown Dinâmico de Modelos:**
- `fetchAvailableModels()` em `claude.ts` — busca modelos da API do provider em tempo real
- Gemini: `GET /v1beta/models?key=` filtra por `generateContent`
- OpenRouter: `GET /api/v1/models` filtra por `:free`
- UI: dropdown `<select>` quando há modelos disponíveis, input texto quando não há
- Carrega ao abrir settings, trocar provider ou salvar API key

**Gemma 3 27B como Default do Gemini:**
- Trocado de `gemini-2.5-flash` para `gemma-3-27b-it` — quota diária muito maior (~14k vs 250 RPD)
- Gemma não suporta `system` role — código detecta modelo gemma e injeta system prompt como user/assistant

**Resultado:** ✅ Build OK, 170 testes passando.

---

## 🎯 PRÓXIMOS PASSOS

### ✅ COMPLETADO — Épicos 1, 2, 3 + Épico 4 (parcial)
- ✅ Jogo Z-machine funcional e testado (ifvms.js + WebGlk)
- ✅ Assistente IA com streaming, game status persistido em IndexedDB
- ✅ Mapa de locais visitados com saídas e notas
- ✅ Save/load de progresso com slots nomeados (cross-session)
- ✅ UI/UX polish (PT-BR, drag-and-drop, confirmações inline, markdown)
- ✅ Sistema de temas (4 temas: Dark Orange, Amber Terminal, Green Phosphor, Parchment)
- ✅ Sistema de providers (LM Studio, Gemini, OpenAI, custom) com config na UI
- ✅ Debug mode, efeito typewriter, scroll inteligente
- ✅ Save/load preserva chat da IA + correções de race conditions
- ✅ Testes unitários (166 testes, 98.35% coverage)
- ✅ CI via GitHub Actions (bloqueia merge em falha)
- ✅ Refatoração em módulos testáveis (GameEngine + WebGlk)

### 📋 Pendente — Épico 4
- ⬜ Sugestões proativas da IA (modo ativo)
- ⬜ Testes com outros jogos além de Zork I
- ⬜ Deploy inicial (Vercel/Netlify)

### 🚀 Médio Prazo
- ⬜ Serverless function proxy (para proteger API keys em produção)
- ⬜ Landing page e onboarding
- ⬜ Sistema de tracking inteligente (IA analisa progresso automaticamente)

---

## 📊 STATUS ATUAL DO PROJETO

**Versão:** 0.5.0-alpha
**Última Sessão:** 2026-03-01 (Sessão 9)
**Branch:** main (CI ativo — GitHub Actions)
**Testes:** 166 passando | 98.35% branch coverage
**Repositório GitHub:** https://github.com/sataaa/yarner

**Funcionalidades Completas e Testadas:**
- ✅ Upload e carregamento de jogos z-machine (.z3, .z4, .z5, .z8) com drag-and-drop
- ✅ Interface de jogo funcional (terminal-style, scroll interno, histórico de comandos ↑↓)
- ✅ Captura de output via WebGlk custom (módulo testável, 100% coverage)
- ✅ Assistente IA via API OpenAI-compatible (LM Studio, Ollama, OpenAI, etc.)
- ✅ Smart diff do game history (envia apenas novidades à IA)
- ✅ Game status estruturado pela IA — persistido em IndexedDB
- ✅ Mapa de locais visitados (saídas coloridas, notas por local, terceira coluna expansível)
- ✅ Save/load de progresso com slots nomeados
- ✅ Markdown nas respostas da IA (com sanitização XSS)
- ✅ Sistema de temas com 4 opções (persistido em localStorage)
- ✅ Sistema de providers (LM Studio, Gemini, OpenAI, custom) com configuração na UI
- ✅ Debug mode para diagnóstico de game status JSON
- ✅ Efeito typewriter no jogo e no chat da IA
- ✅ Save/load preserva chat da IA completo
- ✅ Scroll inteligente (não puxa pra baixo quando lendo texto acima)

**Pendente:**
- ⬜ Deploy em produção

---

**Última atualização:** 2026-03-01 (Sessão 9)
**Próxima revisão:** Sessão 10
