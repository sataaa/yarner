# MEMÓRIA DO PROJETO YARNER

> **PROPÓSITO:** Contexto essencial e decisões do projeto. Detalhes de cada sessão estão em `docs/sessao-NN.md`.

---

## 📋 INFORMAÇÕES BÁSICAS

- **Nome do Projeto:** Yarner ("One who tells yarns/stories" + jogador)
- **Owner:** Godoy
- **Data de Início:** 2026-02-11
- **Linguagem de Comunicação:** Português Brasileiro
- **Repositório GitHub:** https://github.com/sataaa/yarner

---

## 🎯 VISÃO E CONCEITO

Interface web para jogar text adventures (Z-machine) com um assistente de IA ao lado. Split-view: esquerda = jogo (ifvms.js + WebGlk custom), direita = chat IA. A IA lê o output do jogo em tempo real, mantém notas sobre o progresso e ajuda o jogador quando solicitado.

---

## 🏗️ DECISÕES DE ARQUITETURA

### Stack Tecnológica
- **Frontend:** SvelteKit (adapter-static, SPA mode) + TypeScript
- **Z-Machine:** ifvms.js (não Parchment.js — sem API programática) + WebGlk custom
- **Armazenamento:** IndexedDB via `idb` (DB v3: `gameStatus`, `chatHistory`, `gameSaves`, `gameLibrary`)
- **API de IA:** OpenAI-compatible — funciona com LM Studio, Ollama, OpenAI, OpenRouter, etc.
- **Escopo MVP:** Apenas Z-machine (.z3, .z4, .z5, .z8). Sem Glulx, sem multiplayer, sem backend complexo.

### AI Memory Notes
A IA mantém um "caderno de notas" (`AIMemory = string[]`) — lista de até 20 notas que ela gerencia via operações ADD/REMOVE/UPDATE. Persiste em IndexedDB por jogo. Delimitadores: `MEMORY_UPDATE_START` / `MEMORY_UPDATE_END`. Parser com 1 regex + `applyMemoryOperations()`.

### Race Conditions Resolvidas
| Cenário | Ordem |
|---------|-------|
| Restart | `resetAIStateForRestart()` ANTES de `restartGame()` |
| Load slot (in-game) | `restoreAIMemoryFromSave()` ANTES de `loadFromSaveSlot()` |
| Load slot (tela inicial) | `saveAIMemory/saveChatHistory(slot.gameName)` ANTES de `loadFromSaveSlot()` |
| Novo jogo (upload) | `clearGameAIData()` ANTES de `loadGame()` |
| Recarregar da biblioteca | NÃO limpar AI data — preservar dados do IDB |

Causa raiz: reactive `$: if ($isGameLoaded && $currentGameName)` dispara `loadAIStateForGame` do IDB.
Nota: `restoreAIMemoryFromSave()` usa `get(gameState).gameName` — não funciona na tela inicial (gameName vazio).

### Jogos Validados
- Lista hardcoded em `src/lib/data/validatedGames.ts`: SHA-256 → nome canônico
- Lookup: `getValidatedGameName(sha256)`, `isValidatedGame(sha256)`
- **ifvms.js muta o ArrayBuffer in-place** (memória dinâmica do Z-Machine) — SHA de `slot.gameData` difere do original. Para resolver displayName em saves, buscar o SHA original na biblioteca pelo `gameName`.
- Upload unificado: sempre adiciona à biblioteca primeiro, jogador inicia de lá
- Upload duplicado: banner "já está na biblioteca" + highlight com flash CSS

---

## 🔄 HISTÓRICO DE SESSÕES

| # | Data | Tema | Link |
|---|------|------|------|
| 1 | 2026-02-11 | Brainstorm e Setup | [docs/sessao-01.md](docs/sessao-01.md) |
| 2 | 2026-02-11 | Épico 1: Jogo Funcional | [docs/sessao-02.md](docs/sessao-02.md) |
| 3 | 2026-02-16 | Validação Épico 1 | [docs/sessao-03.md](docs/sessao-03.md) |
| 4 | 2026-02-16 | Épico 2: Assistente IA | [docs/sessao-04.md](docs/sessao-04.md) |
| 5 | 2026-02-18 | Épico 3: Mapa de Locais (depois removido) | [docs/sessao-05.md](docs/sessao-05.md) |
| 6 | 2026-02-18 | Épico 4: Save/Load | [docs/sessao-06.md](docs/sessao-06.md) |
| 7 | 2026-02-18 | UI/UX Polish | [docs/sessao-07.md](docs/sessao-07.md) |
| 8 | 2026-02-21 | Testes, CI e Refatoração | [docs/sessao-08.md](docs/sessao-08.md) |
| 9 | 2026-03-01 | Temas, Providers, AI Memory Notes | [docs/sessao-09.md](docs/sessao-09.md) |
| 10 | 2026-03-01 | Fechar Jogo, Biblioteca, Quick-Load | [docs/sessao-10.md](docs/sessao-10.md) |
| 11 | 2026-03-01 | Jogos Validados, Upload Unificado, Sobrescrita de Saves | [docs/sessao-11.md](docs/sessao-11.md) |

---

## 📊 STATUS ATUAL

**Versão:** 0.7.0-alpha
**Última Sessão:** 11 (2026-03-01)
**Testes:** 200 passando | 99%+ coverage
**CI:** GitHub Actions (bloqueia merge em falha)

### ✅ Completado
- Jogo Z-machine funcional (ifvms.js + WebGlk)
- Assistente IA com streaming e AI Memory Notes
- Save/load com slots nomeados (preserva chat + memória da IA)
- UI/UX: PT-BR, drag-and-drop, confirmações inline, markdown, typewriter
- Sistema de temas (4 temas)
- Sistema de providers (LM Studio, Gemini, OpenAI, OpenRouter, custom)
- Debug mode, scroll inteligente
- Testes unitários + CI
- Botão fechar jogo (voltar à tela inicial)
- Biblioteca de jogos (IDB v3, SHA-256, ArrayBuffer persistido)
- Quick-load na tela inicial (3 saves recentes por jogo)
- Jogos validados (SHA-256 → nome canônico, badge ✓, Zork I e II)
- Upload unificado (adiciona à biblioteca, detecção de duplicatas com highlight)
- Sobrescrita de saves (botão rápido no painel de save)
- Layout side-by-side (uploader + biblioteca na tela inicial)

### 📋 Backlog (não refinado)
1. **i18n** — detectar língua do sistema, permitir trocar (inicialmente pt-BR e inglês)
2. **Build redistribuível (HTML único)** — pipeline para gerar HTML puro sem backend, publicar no release do GitHub para download (avaliar criar GitHub Pages para isso)

---

**Última atualização:** 2026-03-01 (Sessão 11)
