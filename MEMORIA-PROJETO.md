# MEMÓRIA DO PROJETO YARNER

> **PROPÓSITO:** Este arquivo contém o histórico completo de decisões, contexto e conhecimento acumulado do projeto. Deve ser consultado sempre e atualizado com qualquer mudança significativa.

---

## 📋 INFORMAÇÕES BÁSICAS

- **Nome do Projeto:** Yarner
- **Significado:** "One who tells yarns/stories" + jogador
- **Owner:** Godoy
- **Data de Início:** 2026-02-11
- **Status Atual:** Épico 1 ✅ COMPLETO — Épico 2 ✅ COMPLETO — Épico 3 pendente
- **Linguagem de Comunicação:** Português Brasileiro

---

## 🎯 VISÃO E CONCEITO

### Descrição Original (Godoy)

"Uma interface para jogar jogos de text adventure com um parceiro de IA te ajudando enquanto você joga. Do lado esquerdo você carregará um jogo e do lado direito você poderá conectar a uma IA (como Claude) para poder ler o texto do output e seu input enquanto você joga e dar dicas de como continuar o jogo."

### Capacidades do Assistente IA

1. **Leitura Contextual**
   - Lê o output do jogo em tempo real
   - Entende o contexto da história

2. **Assistência Inteligente**
   - Oferece dicas quando solicitado
   - Sugere como progredir na história

3. **Tracking de Progresso**
   - Mapa mental dos itens coletados
   - Lista de coisas não exploradas (objetos, direções)
   - Auxilia na organização do jogador

---

## 🏗️ DECISÕES DE ARQUITETURA

### Decisão 1: Web-First ao invés de Desktop

**Contexto:**
Inicialmente, o Master sugeriu Electron para uma aplicação desktop. Godoy questionou: "não podemos fazer isso online para ajudar ainda mais na penetração da ideia/produto?"

**Decisão:**
✅ **Web application (SPA)** ao invés de Electron

**Raciocínio:**
- Zero friction para experimentar
- Barreira de entrada zero (apenas URL)
- Melhor para viralização e adoção
- Não precisa instalação
- Multiplataforma automático
- Deploy gratuito (Vercel/Netlify)
- Updates instantâneos

**Impacto:**
- Stack ajustada para web-first
- Uso de Parchment.js client-side
- IndexedDB ao invés de SQLite
- Serverless functions para API

---

### Decisão 2: Stack Tecnológica

**Frontend:**
- **SvelteKit** com adapter-static (modo SPA)
- **Razão:** Performance excepcional, bundle size mínimo, reatividade nativa perfeita para split-view

**Z-Machine Runtime:**
- **ifvms.js** (MUDANÇA: originalmente Parchment.js)
- **Razão:** API programática completa, permite captura de I/O em tempo real, essencial para integração com IA
- **WebGlk custom:** Implementação web-based do Glk para ifvms.js

**Backend:**
- **Serverless Functions** (Vercel/Netlify)
- **Razão:** Protege API keys, mínimo necessário (1-2 endpoints), gratuito

**Armazenamento:**
- **IndexedDB** (com library `idb`)
- **Razão:** Storage robusto (GBs), perfeito para web, persistente, moderno

**API de IA:**
- **Anthropic Claude API**
- **Razão:** Context window grande (200k), streaming, excelente para análise de texto

---

### Decisão 3: Escopo do MVP

**Incluído na v1.0:**
1. ✅ Jogar z-machine games (.z5, .z8)
2. ✅ IA lendo output em tempo real
3. ✅ Chat livre com IA sobre o jogo
4. ✅ Split-view (jogo | assistente)
5. ✅ Upload de arquivo via navegador
6. ✅ Histórico básico (IndexedDB)

**Explicitamente fora da v1.0:**
- ❌ Mapeamento visual/automático
- ❌ Glulx ou outros formatos (apenas z-machine)
- ❌ Multiplayer
- ❌ Conquistas/achievements
- ❌ Backend complexo

**Razão:**
Focar no essencial para lançar rápido e validar a ideia. Iteração futura baseada em feedback.

---

### Decisão 4: Formato de Text Adventures

**Contexto:**
Master perguntou sobre formatos: Z-machine, Glulx, ou web-based?

**Decisão:**
✅ **Apenas Z-machine (.z5, .z8) para começar**

**Razão:**
- Começar simples e focado
- Z-machine tem a maior biblioteca de jogos clássicos (Infocom, etc.)
- Parchment.js tem suporte maduro
- Pode expandir para Glulx em versões futuras

---

## 💡 OPÇÕES DE NOME CONSIDERADAS

### Primeira Rodada (Rejeitadas)
- ❌ AI Adventure Companion
- ❌ TextQuest Helper

### Segunda Rodada
1. **Yarner** ⭐ **ESCOLHIDO**
2. Zork Buddy
3. Parser Pal
4. Adventure Mentor
5. TextMate Adventures
6. Infocom Copilot
7. Story Navigator
8. Quest Companion

**Razão da escolha:**
"Yarner" combina "yarn" (história/conto) com "player" (jogador), sugerindo tanto o aspecto narrativo dos text adventures quanto o papel do usuário.

---

## 🎨 FLUXO DE FUNCIONAMENTO PLANEJADO

```
┌─────────────────────────────────────────────────────────┐
│  1. Usuário acessa yarner.app (ou domínio escolhido)    │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  2. Upload de arquivo .z5/.z8 via File API              │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  3. ifvms.js processa o jogo no navegador                │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  4. Interface split-view carregada:                     │
│     ├─ Esquerda: Jogo (ifvms.js)                        │
│     └─ Direita: Chat IA (Claude)                        │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  5. Loop de jogo:                                        │
│     ├─ Jogador digita comando                           │
│     ├─ Output enviado para serverless function          │
│     ├─ Function chama Claude API                        │
│     ├─ Resposta da IA streamed de volta                 │
│     └─ IndexedDB salva: histórico, itens, progressão    │
└─────────────────────────────────────────────────────────┘
```

---

## 📁 ESTRUTURA DE ARQUIVOS PLANEJADA

```
yarner/
├── MANDAMENTOS.md              # Regras fundamentais [✅ CRIADO]
├── MEMORIA-PROJETO.md          # Este arquivo [✅ CRIADO]
├── README.md                   # Documentação [ ]
├── package.json                # [ ]
├── svelte.config.js            # [ ]
├── vite.config.js              # [ ]
├── src/
│   ├── routes/
│   │   ├── +page.svelte       # Página principal (upload + split-view)
│   │   └── +layout.svelte     # Layout global
│   ├── lib/
│   │   ├── components/
│   │   │   ├── GamePanel.svelte       # Painel esquerdo (ifvms.js) [✅]
│   │   │   ├── AIAssistant.svelte     # Painel direito (Chat IA) [✅]
│   │   │   └── FileUploader.svelte    # Upload .z5/.z8 [✅]
│   │   ├── stores/
│   │   │   ├── gameState.ts           # Estado do jogo atual [✅]
│   │   │   ├── aiPersistence.ts       # IndexedDB para IA [✅]
│   │   │   ├── aiChat.ts              # Store central do AI chat [✅]
│   │   │   └── tracking.ts            # Items, locations, progress [PENDENTE]
│   │   ├── api/
│   │   │   └── claude.ts              # Cliente API OpenAI-compatible [✅]
│   │   └── zmachine/
│   │       └── zvm-wrapper.ts         # ifvms.js + WebGlk custom [✅]
│   └── app.html
├── static/                            # Assets estáticos
└── api/
    └── chat.ts                        # Serverless function (proxy Claude) [PENDENTE]
```

---

## 🔄 HISTÓRICO DE SESSÕES

### Sessão 1: 2026-02-11 (Party Mode Inicial - Setup)

**Participantes:** bmad-master + Godoy

**Atividades:**
1. ✅ Brainstorm inicial do conceito
2. ✅ Definição do nome (Yarner)
3. ✅ Escolha da stack tecnológica
4. ✅ Decisão arquitetural: Web-first ao invés de desktop
5. ✅ Definição do escopo MVP
6. ✅ Criação de MANDAMENTOS.md
7. ✅ Criação de MEMORIA-PROJETO.md
8. ✅ Inicialização do projeto SvelteKit
9. ✅ Estrutura básica criada
10. ✅ Configuração Git e primeiro commit

**Decisões Importantes:**
- Web application ao invés de Electron (melhor penetração)
- Z-machine apenas (.z5, .z8) para MVP
- IndexedDB ao invés de SQLite
- Foco em simplicidade e lançamento rápido

---

### Sessão 2: 2026-02-12 (Party Mode - Épico 1: Jogo Funcional)

**Participantes:** bmad-master + Godoy

**Problema Encontrado:**
- Instalamos pacote "parchment" errado (Quill editor)
- Parchment.js correto (curiousdannii/parchment) não tem API programática
- Impossível capturar output do jogo para enviar à IA

**Solução Implementada:**
- **Mudança de stack:** Parchment.js → **ifvms.js**
- ifvms.js tem API JavaScript completa com captura de I/O
- Criamos WebGlk custom para integração web

**Atividades Realizadas:**
1. ✅ Pesquisa sobre Parchment.js e alternativas (agente Explore)
2. ✅ Criação de plano de implementação detalhado
3. ✅ Remoção do parchment incorreto
4. ✅ Instalação do ifvms.js
5. ✅ Criação do `zvm-wrapper.ts` (GameEngine + WebGlk)
6. ✅ Criação do `FileUploader.svelte` (upload de jogos)
7. ✅ Criação do `GamePanel.svelte` (interface terminal)
8. ✅ Criação do `gameState.ts` (store Svelte)
9. ✅ Integração na página principal
10. ✅ Commit e push para GitHub

**Arquivos Criados:**
- `src/lib/zmachine/zvm-wrapper.ts` (GameEngine + WebGlk)
- `src/lib/components/FileUploader.svelte`
- `src/lib/components/GamePanel.svelte`
- `src/lib/stores/gameState.ts`

**Funcionalidades Implementadas:**
- ✅ Upload de arquivos .z3, .z4, .z5, .z8
- ✅ Carregamento e execução de jogos z-machine
- ✅ Interface terminal com output scrollable
- ✅ Input de comandos com histórico (setas ↑↓)
- ✅ Botões de restart e clear output
- ✅ Split-view preparado (jogo | placeholder IA)

**Status Atual:**
- **Épico 1: IMPLEMENTADO** ⚠️ (NÃO TESTADO)
- Código completo mas não validado com jogo real
- Precisa testar: upload, carregamento, gameplay
- Após testes bem-sucedidos → marcar como COMPLETO

**Decisões Importantes:**
- **CRÍTICA:** Projeto pode ser vendido futuramente
- Toda documentação deve facilitar transferência para outros devs
- Mandamentos atualizados com princípio de documentação
- Código deve ser auto-explicativo e bem comentado

**Próximos Épicos:**
- Épico 2: Assistente IA (não iniciado)
- Épico 3: Sistema de Tracking (não iniciado)

---

### Sessão 3: 2026-02-16 (Party Mode - Validação do Épico 1)

**Participantes:** bmad-master + Godoy

**Objetivo:** Testar o Épico 1 com um jogo real (Zork I)

**Bugs Encontrados e Corrigidos:**
1. **`Object.create(ZVM)` → `new ZVM()`** — ifvms.js requer instanciação com `new`, não `Object.create`
2. **WebGlk completamente reescrito** — A implementação original era muito simplificada (~5 métodos). O ifvms.js exige ~60 métodos Glk (output, input, windows, streams, styles, gestalt, etc.). Reescrito com implementação completa.
3. **Callback de output registrado antes de `loadGame()`** — O VM produz texto inicial durante `vm.init()`, mas o callback era registrado depois, perdendo o texto introdutório do jogo.
4. **GamePanel refatorado para usar store como fonte única de verdade** — GamePanel tinha seu próprio array local `gameOutput` e registrava um `onOutput()` que substituía o do store. Refatorado para ler de `gameState.gameHistory` (store) e não duplicar callbacks.
5. **Referência a `isWaitingForInput` removida do template** — Variável foi removida do script mas permanecia no HTML.
6. **Layout com scroll correto** — `min-height: 100vh` → `height: 100vh` + `overflow: hidden` para que o output do jogo tenha scroll interno ao invés de expandir a página inteira.

**Lições Aprendidas:**
- ifvms.js depende de uma implementação Glk robusta; não funciona com stubs mínimos
- A ordem de registro de callbacks é crítica — sempre registrar antes da operação que produz output
- Evitar múltiplos pontos de registro de callback (fonte única de verdade no store)

**Resultado:**
- **Épico 1: ✅ COMPLETO E TESTADO** com Zork I (.z5)
- Upload funcional, texto inicial aparecendo, gameplay funcionando, scroll correto

---

### Sessão 5: 2026-02-18 (Party Mode - Épico 3: Mapa de Locais)

**Participantes:** bmad-master + Godoy

**Objetivo:** Implementar o mapa de locais visitados (Épico 3).

**Decisões de Design (Godoy):**
- Nome mais preciso: "Mapa de Locais" ao invés de "Sistema de Tracking"
- Lista de itens descartada (inventário já aparece no log do jogo via comando `inventory`)
- Foco: locais visitados + saídas exploradas/não exploradas + notas de estado do local
- UI: botão 🗺️ abre mapa inline no painel da IA; botão ↗ expande para terceira coluna (320px)
- **Não duplicar sistema**: `locaisVisitados` é um campo novo no `GameStatus` existente — a IA já atualiza o status, basta expandir o schema
- Schema de saídas: `"north": "Forest Path"` (se explorado) ou `"north": "nao explorado"`

**Arquitetura Implementada:**
- Zero sistema paralelo: `locaisVisitados` é campo do `GameStatus` já gerenciado pela IA
- Merge aditivo no parser: dados de locais nunca são apagados (mesmo que a IA retorne `{}` vazio)
- Store `locationMapExpanded` (writable) controla terceira coluna sem prop-drilling
- `LocationMap.svelte` é renderizado em dois contextos: inline (dentro de AIAssistant) e terceira coluna (+page.svelte)

**Arquivos Criados:**
- `src/lib/components/LocationMap.svelte` — lista de locais com saídas coloridas e notas

**Arquivos Modificados:**
- `src/lib/stores/aiPersistence.ts` — tipo `LocalVisitado` + campo `locaisVisitados` no `GameStatus`
- `src/lib/api/claude.ts` — system prompt atualizado com instrução de `locaisVisitados`; merge aditivo no parser
- `src/lib/stores/aiChat.ts` — store `locationMapExpanded` exportada
- `src/lib/components/AIAssistant.svelte` — botão 🗺️ + mapa inline
- `src/routes/+page.svelte` — terceira coluna condicional quando `locationMapExpanded`

**Bugs Encontrados e Corrigidos (durante testes):**
1. **Modelo 8B vaza status na resposta visível** — escrevia "O status do jogo agora é:" antes do bloco JSON. Corrigido adicionando instrução explícita no prompt: "NAO escreva introducao antes do bloco"
2. **`locaisVisitados` sobrescrito com `{}`** — o spread `...parsed` apagava dados existentes quando o modelo retornava objeto vazio. Corrigido com merge aditivo: `{ ...fallbackStatus.locaisVisitados, ...(parsed.locaisVisitados || {}) }`
3. **Template JSON complexo demais para 8B** — exemplo de `locaisVisitados` aninhado dentro do template de uma linha confundia o modelo. Simplificado: template principal mostra `"locaisVisitados":{}`, instrução de formato fica em texto separado

**Limitação Conhecida:**
- Modelos pequenos (8B, como LM Studio com llama-3.1-8b) têm dificuldade em gerar o JSON do game status corretamente e de forma consistente — às vezes omitem campos, usam valores vazios, ou não seguem o formato de `locaisVisitados`. O sistema funciona mas o preenchimento do mapa depende da qualidade do modelo. Modelos maiores (70B+, Claude, GPT-4) funcionam muito melhor.

**Funcionalidades Implementadas:**
- ✅ Campo `locaisVisitados` no GameStatus (persistido em IndexedDB)
- ✅ IA instruda a rastrear locais, saídas e notas por local
- ✅ `LocationMap.svelte` — lista de locais com saídas (verde = explorado, cinza = não explorado)
- ✅ Local atual marcado com ▶ laranja
- ✅ Notas de estado por local (itens no chão, portas, etc.)
- ✅ Botão 🗺️ no painel da IA (inline, colapsável)
- ✅ Botão ↗/↙ para expandir/recolher terceira coluna
- ✅ Merge aditivo: dados de locais nunca são perdidos entre interações

**Resultado:**
- **Épico 3: ✅ COMPLETO** — mapa de locais implementado e testado com Zork I + LM Studio

---

### Sessão 4: 2026-02-16 (Party Mode - Épico 2: Assistente IA)

**Participantes:** bmad-master + Godoy

**Objetivo:** Implementar o assistente IA que lê o output do jogo e ajuda o jogador.

**Decisões de Design (Godoy):**
- API key fornecida pelo usuário (client-side, sem serverless para MVP)
- Smart diff: `lastSentGameHistoryIndex` rastreia o que já foi enviado à IA, só envia o novo
- IA mantém "game status" estruturado (localização, inventário, objetivos, coisas não exploradas, observações) persistido em IndexedDB
- Comportamento passivo (responde quando perguntado, não proativo)
- Game status serve como memória entre sessões de chat (não precisa reenviar todo o histórico)

**Pivô de API:**
- Plano original: SDK Anthropic com `dangerouslyAllowBrowser: true`
- Problema: Godoy não tem API key separada (usa claude.ai consumer)
- Solução: **LM Studio local** em `localhost:55511` com `meta-llama-3.1-8b-instruct-abliterated`
- Reescrito `claude.ts` para usar API OpenAI-compatible via `fetch` (sem SDK)

**Bug Principal — CORS:**
- Navegador (Windows) → LM Studio (Windows localhost:55511) bloqueado por CORS
- O preflight OPTIONS não tinha `Access-Control-Allow-Origin`
- Solução: Habilitar CORS nas configurações do servidor do LM Studio

**Ajuste — Formato do Game Status:**
- Modelo 8B não seguia bem o formato ` ```game-status ``` ` com backticks
- Trocado para delimitadores de texto simples: `GAME_STATUS_JSON_START` / `GAME_STATUS_JSON_END`
- Parser tornado robusto: tenta 4 padrões diferentes (novo formato, game-status, json, json genérico)
- Streaming strip atualizado para esconder todos os formatos durante exibição ao vivo

**Arquivos Criados:**
- `src/lib/stores/aiPersistence.ts` — Persistência IndexedDB (game status + chat por jogo)
- `src/lib/api/claude.ts` — Cliente API OpenAI-compatible com streaming SSE
- `src/lib/stores/aiChat.ts` — Store central do AI chat (segue padrão gameState.ts)
- `src/lib/components/AIAssistant.svelte` — Interface de chat completa

**Arquivos Modificados:**
- `src/routes/+page.svelte` — Substituído placeholder por `<AIAssistant />`
- `vite.config.ts` — Adicionado proxy `/ai-api` (não usado no final, browser chama direto)

**Funcionalidades Implementadas:**
- ✅ Chat com IA via API OpenAI-compatible (LM Studio, Ollama, OpenAI, etc.)
- ✅ Smart diff do game history (só envia novidades à IA)
- ✅ Game status extraído e mantido pela IA (localização, inventário, objetivos)
- ✅ Painel colapsável de game status (botão 📋)
- ✅ Streaming de respostas com cursor pulsante
- ✅ Persistência em IndexedDB (chat + game status por jogo)
- ✅ Botão limpar chat (🗑️) preservando game status como memória
- ✅ API key opcional (não necessária para servidores locais)

**Lições Aprendidas:**
- Modelos pequenos (8B) não seguem instruções de formato complexo com backticks; delimitadores de texto simples funcionam melhor
- CORS é problema comum em chamadas cross-origin de localhost; LM Studio tem toggle para habilitar
- WSL2 e Windows têm stacks de rede separados; browser no Windows chama direto o LM Studio no Windows
- Game status como memória persistente entre sessões de chat é mais eficiente que guardar todo o log

**Resultado:**
- **Épico 2: ✅ COMPLETO E TESTADO** com LM Studio + Zork I
- Chat funcional, game status extraído corretamente, streaming funcionando

---

## 🎯 PRÓXIMOS PASSOS

### ✅ COMPLETADO - Épico 1: Jogo Funcional
1. ✅ Inicializar projeto SvelteKit
2. ✅ Criar estrutura de diretórios
3. ✅ Configurar adapter-static para SPA
4. ✅ Criar README.md básico
5. ✅ Integrar ifvms.js (mudança de Parchment.js)
6. ✅ Criar componente FileUploader
7. ✅ Criar componente GamePanel
8. ✅ Criar gameState store
9. ✅ Integrar tudo na página principal

### ✅ COMPLETADO - Épico 2: Assistente IA
1. ✅ Criar `aiPersistence.ts` (IndexedDB para game status e chat)
2. ✅ Criar `claude.ts` (cliente API OpenAI-compatible)
3. ✅ Criar `aiChat.ts` (store central do AI chat)
4. ✅ Criar `AIAssistant.svelte` (interface de chat)
5. ✅ Conectar output do jogo via smart diff
6. ✅ Implementar streaming de respostas SSE
7. ✅ Parser robusto para game status (múltiplos formatos)
8. ✅ Painel colapsável de game status (📋)
9. ✅ Botão limpar chat com preservação de game status (🗑️)
10. ✅ Testar com LM Studio + Zork I

### ✅ COMPLETADO - Épico 3: Mapa de Locais
1. ✅ Tipo `LocalVisitado` e campo `locaisVisitados` no `GameStatus`
2. ✅ System prompt atualizado com instrução de rastreamento de locais
3. ✅ Merge aditivo no parser (dados nunca apagados)
4. ✅ `LocationMap.svelte` com saídas coloridas e notas
5. ✅ Botão 🗺️ inline no painel da IA
6. ✅ Expansão para terceira coluna (store `locationMapExpanded`)

### 📋 Épico 4: Próximas Melhorias (a definir com Godoy)
1. ⬜ Save/load de progresso do jogo
2. ⬜ UI/UX polish e responsividade
3. ⬜ Sugestões proativas da IA (modo ativo)
4. ⬜ Testes com outros jogos além de Zork I
5. ⬜ Deploy inicial (Vercel/Netlify)

### 🚀 Médio Prazo
1. ⬜ Sistema de tracking inteligente (IA analisa progresso)
2. ⬜ Sugestões proativas da IA
3. ⬜ UI/UX polish e responsividade
4. ⬜ Testes com jogos reais (Zork, etc)
5. ⬜ Deploy inicial (Vercel/Netlify)
6. ⬜ Landing page e onboarding

---

## 💭 NOTAS E OBSERVAÇÕES

### Sobre o Nome "Yarner"
- Yarn = história, conto, narrativa
- Yarner = contador de histórias / jogador
- Simples, memorável, .com disponível (provavelmente)

### Sobre a Abordagem Web-First
Godoy teve uma excelente percepção ao questionar a necessidade de Electron. A web oferece:
- Distribuição instantânea
- Facilidade de experimentação
- Viral potential
- Zero maintenance para usuários

Esta é uma decisão estratégica que pode definir o sucesso do projeto.

### Sobre o Escopo MVP
Importante manter disciplina e NÃO adicionar features fora do MVP, mesmo que sejam "fáceis". Lançar rápido é mais valioso que lançar perfeito.

---

## 📝 LEMBRETES IMPORTANTES

1. **Sempre consultar este arquivo** antes de fazer mudanças significativas
2. **Atualizar este arquivo** quando novas decisões forem tomadas
3. **Recarregar party-mode** (`/bmad-party-mode`) se a conversa for compactada
4. **Seguir MANDAMENTOS.md** em todas as circunstâncias
5. **Manter simplicidade** - MVP-first sempre
6. **⚠️ CRÍTICO:** Documentar pensando em transferência futura (possível venda)

---

## 📊 STATUS ATUAL DO PROJETO

**Versão:** 0.4.0-alpha
**Última Sessão:** 2026-02-18 (Sessão 5)
**Épico Atual:** Épico 3 ✅ COMPLETO — Iniciando Épico 4

**Funcionalidades Completas e Testadas:**
- ✅ Upload e carregamento de jogos z-machine (.z3, .z4, .z5, .z8)
- ✅ Interface de jogo funcional (terminal-style)
- ✅ Captura de output do jogo via WebGlk custom
- ✅ Input de comandos com histórico (setas ↑↓)
- ✅ Scroll interno no painel do jogo
- ✅ Gerenciamento de estado centralizado (Svelte store)
- ✅ Assistente IA via API OpenAI-compatible (LM Studio, Ollama, OpenAI, etc.)
- ✅ Smart diff do game history (envia apenas novidades à IA)
- ✅ Game status estruturado mantido pela IA (localização, inventário, objetivos)
- ✅ Persistência em IndexedDB (chat + game status por jogo)
- ✅ Botão limpar chat preservando game status como memória
- ✅ Mapa de locais visitados com saídas exploradas/não exploradas e notas
- ✅ Botão 🗺️ inline + expansão para terceira coluna

**Pendente:**
- ⬜ Save/load de progresso do jogo (Épico 4)
- ⬜ Deploy em produção

**Repositório GitHub:** https://github.com/sataaa/yarner
**Branch Atual:** main

---

**Última atualização:** 2026-02-18 (Sessão 5 - Épico 3 Completo e Testado)
**Próxima revisão:** Durante implementação do Épico 4
