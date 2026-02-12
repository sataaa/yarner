# MEMÓRIA DO PROJETO YARNER

> **PROPÓSITO:** Este arquivo contém o histórico completo de decisões, contexto e conhecimento acumulado do projeto. Deve ser consultado sempre e atualizado com qualquer mudança significativa.

---

## 📋 INFORMAÇÕES BÁSICAS

- **Nome do Projeto:** Yarner
- **Significado:** "One who tells yarns/stories" + jogador
- **Owner:** Godoy
- **Data de Início:** 2026-02-11
- **Status Atual:** Fase inicial - Setup e planejamento
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
- **Parchment.js**
- **Razão:** JavaScript puro, 100% client-side, suporta z-machine v3-8, mantido ativamente

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
│  3. Parchment.js processa o jogo no navegador           │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  4. Interface split-view carregada:                     │
│     ├─ Esquerda: Jogo (Parchment)                       │
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
│   │   │   ├── GamePanel.svelte       # Painel esquerdo (Parchment)
│   │   │   ├── AIAssistant.svelte     # Painel direito (Chat IA)
│   │   │   ├── FileUploader.svelte    # Upload .z5/.z8
│   │   │   └── SplitView.svelte       # Container split
│   │   ├── stores/
│   │   │   ├── gameState.ts           # Estado do jogo atual
│   │   │   ├── aiChat.ts              # Histórico do chat
│   │   │   └── tracking.ts            # Items, locations, progress
│   │   ├── api/
│   │   │   └── claude.ts              # Client para serverless function
│   │   └── zmachine/
│   │       └── parchment-wrapper.ts   # Wrapper do Parchment.js
│   └── app.html
├── static/
│   └── parchment/             # Parchment.js assets
└── api/
    └── chat.ts                # Serverless function (proxy Claude)
```

---

## 🔄 HISTÓRICO DE SESSÕES

### Sessão 1: 2026-02-11 (Party Mode Inicial)

**Participantes:** bmad-master + Godoy

**Atividades:**
1. ✅ Brainstorm inicial do conceito
2. ✅ Definição do nome (Yarner)
3. ✅ Escolha da stack tecnológica
4. ✅ Decisão arquitetural: Web-first ao invés de desktop
5. ✅ Definição do escopo MVP
6. ✅ Criação de MANDAMENTOS.md
7. ✅ Criação de MEMORIA-PROJETO.md
8. ⏳ Inicialização do projeto SvelteKit (em andamento)

**Decisões Importantes:**
- Web application ao invés de Electron (melhor penetração)
- Z-machine apenas (.z5, .z8) para MVP
- IndexedDB ao invés de SQLite
- Foco em simplicidade e lançamento rápido

---

## 🎯 PRÓXIMOS PASSOS

### Imediato (Esta Sessão)
1. ⏳ Inicializar projeto SvelteKit
2. ⏳ Criar estrutura de diretórios
3. ⏳ Configurar adapter-static para SPA
4. ⏳ Criar README.md básico

### Curto Prazo (Próximas Sessões)
1. ⬜ Integrar Parchment.js
2. ⬜ Criar componente FileUploader
3. ⬜ Criar componente GamePanel (wrapper Parchment)
4. ⬜ Criar componente AIAssistant (chat interface)
5. ⬜ Implementar SplitView
6. ⬜ Criar serverless function para Claude API
7. ⬜ Implementar IndexedDB store para tracking

### Médio Prazo
1. ⬜ Sistema de tracking de itens
2. ⬜ Sugestões inteligentes da IA
3. ⬜ Histórico de comandos
4. ⬜ UI/UX polish
5. ⬜ Deploy inicial (Vercel/Netlify)

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

---

**Última atualização:** 2026-02-11 (Sessão 1 - Setup Inicial)
**Próxima revisão:** Após inicialização do SvelteKit
