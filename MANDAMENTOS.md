# MANDAMENTOS DO PROJETO YARNER

> **ATENÇÃO:** Este arquivo contém as regras fundamentais do projeto. Deve ser seguido estritamente em todas as sessões de desenvolvimento.

---

## 📜 OS TRÊS MANDAMENTOS FUNDAMENTAIS

### 1️⃣ SEMPRE SIGA O ARQUIVO DE MANDAMENTOS
- Este arquivo (`MANDAMENTOS.md`) é a fonte da verdade do projeto
- Todas as decisões devem estar alinhadas com os princípios aqui definidos
- Em caso de dúvida, consulte este arquivo primeiro

### 2️⃣ SEMPRE RECARREGUE PARTY-MODE APÓS COMPACTAÇÃO
- Quando o Claude compactar a conversa, execute: `/bmad-party-mode`
- Isso garante continuidade do contexto e dos agentes
- Nunca prossiga sem recarregar o contexto adequado

### 3️⃣ MEMÓRIA PERSISTENTE E FIDELIDADE ABSOLUTA
- Sempre consulte `MEMORIA-PROJETO.md` antes de fazer mudanças
- Guarde todas as decisões importantes na memória
- Nunca desvie do que está documentado sem discussão explícita com Godoy
- A memória do projeto é sagrada

### 5️⃣ TESTES UNITÁRIOS OBRIGATÓRIOS
- **TODO** novo módulo TypeScript com lógica de negócio DEVE ter testes unitários (`*.test.ts`)
- **Cobertura mínima obrigatória: 100%** em linhas, branches, funções e statements
- Os thresholds são enforced pelo CI — o merge é bloqueado se a cobertura cair
- Use `vitest` + `fake-indexeddb` para módulos com IndexedDB
- Mock browser APIs e engine externa (`createGameEngine`) em testes de stores
- Use `/* v8 ignore start/stop */` apenas para branches de migração/bootstrap impossíveis de simular em testes (ex: upgrade de IndexedDB)
- Script: `npm run test:coverage` para ver o relatório completo

### 4️⃣ DOCUMENTAÇÃO PARA TRANSFERÊNCIA FUTURA
- **CRÍTICO:** Este projeto pode ser vendido/transferido para outros desenvolvedores
- Toda decisão técnica DEVE ser documentada em `MEMORIA-PROJETO.md`
- TODO código DEVE ter comentários explicativos sobre o "por quê"
- Arquivos complexos DEVEM ter JSDoc/TSDoc completo
- README.md DEVE estar sempre atualizado com setup e arquitetura
- Commits DEVEM ser descritivos e explicativos
- **JAMAIS** assuma que "o próximo dev vai entender"

---

## 🎯 VISÃO DO PROJETO

**Yarner** é uma interface web para jogar text adventures (jogos z-machine) com assistência de IA em tempo real.

### Propósito
Permitir que jogadores desfrutem de text adventures clássicos com um assistente IA que:
- Lê o output do jogo
- Oferece dicas contextuais
- Ajuda a mapear itens coletados
- Sugere direções e objetos não explorados
- Auxilia na progressão da história

---

## 🏗️ ARQUITETURA TÉCNICA

### Stack Tecnológica Definida

**Frontend:**
- **SvelteKit** (modo SPA com adapter-static)
- **TypeScript** (opcional, a definir)
- Deploy estático (Vercel/Netlify/GitHub Pages)

**Z-Machine Runtime:**
- **ifvms.js** (JavaScript Z-Machine interpreter)
- Custom WebGlk wrapper para web integration
- Suporte: Z-machine v3-8 (.z3, .z4, .z5, .z8)
- Carregamento via File API do navegador
- API programática para captura de I/O

**Backend:**
- **Serverless Functions** (Vercel/Netlify)
- Endpoints mínimos para proxy da Claude API
- Protege API keys (não expõe no client)

**Armazenamento:**
- **IndexedDB** (histórico, tracking, progressão)
- Library: `idb` (wrapper promisificado)
- Fallback: LocalStorage para dados leves

**API de IA:**
- **Anthropic Claude API**
- Streaming de respostas
- Context window: 200k tokens

---

## ✅ ESCOPO DO MVP (v1.0)

### Funcionalidades Essenciais

1. **Split-View Interface**
   - Lado esquerdo: Jogo z-machine (Parchment)
   - Lado direito: Chat com assistente IA

2. **Carregamento de Jogos**
   - Upload de arquivos .z5 e .z8
   - Processamento 100% client-side

3. **Assistente IA Contextual**
   - Lê output do jogo em tempo real
   - Responde perguntas do jogador
   - Oferece dicas quando solicitado

4. **Tracking Básico** (IndexedDB)
   - Histórico de comandos
   - Progressão da partida

### Fora do Escopo (v1.0)

- ❌ Mapeamento visual automático
- ❌ Glulx/outros formatos
- ❌ Multiplayer
- ❌ Sistema de conquistas
- ❌ Integração com IFDB

---

## 🚀 PRINCÍPIOS DE DESENVOLVIMENTO

### 1. Web-First
- Barreira de entrada zero
- Acessível via URL
- Sem instalação necessária
- Maximiza adoção e penetração

### 2. Simplicidade
- MVP focado e funcional
- Evitar over-engineering
- Entregar valor rapidamente

### 3. Performance
- Bundle size mínimo
- Loading rápido
- Experiência fluida

### 4. Privacidade
- Jogos processados client-side
- Dados salvos localmente (IndexedDB)
- API keys protegidas no servidor

### 5. Documentação e Manutenibilidade
- **Código limpo e auto-explicativo**
- **Comentários para decisões não-óbvias**
- **Documentação técnica sempre atualizada**
- **Arquitetura clara e bem definida**
- **Facilitar onboarding de novos desenvolvedores**
- **Preparar para possível transferência/venda do projeto**

---

## 📁 ESTRUTURA DO PROJETO

```
yarner/
├── MANDAMENTOS.md          # ⚠️ LEIA PRIMEIRO - Regras fundamentais
├── MEMORIA-PROJETO.md      # 📖 Histórico completo de decisões
├── README.md               # 🚀 Setup, arquitetura e guias
├── src/
│   ├── routes/            # Páginas SvelteKit
│   │   ├── +page.svelte   # Página principal (upload/game)
│   │   └── +layout.svelte # Layout global
│   ├── lib/
│   │   ├── components/    # Componentes reutilizáveis
│   │   │   ├── FileUploader.svelte  # Upload de jogos
│   │   │   └── GamePanel.svelte     # Interface do jogo
│   │   ├── stores/        # Svelte stores (estado global)
│   │   │   └── gameState.ts         # Estado do jogo
│   │   ├── api/           # Integração com APIs externas
│   │   └── zmachine/      # Z-Machine interpreter wrapper
│   │       └── zvm-wrapper.ts       # ifvms.js + WebGlk
│   └── app.html
├── static/                # Assets estáticos (imagens, etc)
└── svelte.config.js       # Configuração SvelteKit
```

---

## 🔄 WORKFLOW DE DESENVOLVIMENTO

1. **Antes de começar qualquer sessão:**
   - Ler `MANDAMENTOS.md` (este arquivo)
   - Ler `MEMORIA-PROJETO.md`
   - Verificar contexto atual

2. **Durante o desenvolvimento:**
   - Atualizar `MEMORIA-PROJETO.md` com decisões importantes
   - Seguir arquitetura definida
   - Manter simplicidade (MVP-first)

3. **Se conversa for compactada:**
   - **IMEDIATAMENTE** executar `/bmad-party-mode`
   - Recarregar contexto completo
   - Continuar de onde parou

---

## 🎨 FILOSOFIA DO YARNER

> "Trazer os text adventures clássicos para a era da IA, tornando-os mais acessíveis e agradáveis para novos jogadores, sem perder a essência do gênero."

**Valores:**
- ✨ Acessibilidade acima de tudo
- 🎮 Respeito aos clássicos
- 🤖 IA como assistente, não como substituto
- 🚀 Lançamento rápido, iteração constante

---

---

## 📝 DIRETRIZES DE DOCUMENTAÇÃO

### Para Novos Desenvolvedores

**Se você está começando neste projeto:**

1. **Leia OBRIGATORIAMENTE nesta ordem:**
   - `README.md` - Overview e setup inicial
   - `MANDAMENTOS.md` - Este arquivo (regras e princípios)
   - `MEMORIA-PROJETO.md` - Histórico completo de decisões

2. **Arquitetura do Código:**
   - `src/lib/zmachine/zvm-wrapper.ts` - Motor do jogo (ifvms + WebGlk)
   - `src/lib/stores/gameState.ts` - Gerenciamento de estado
   - `src/lib/components/` - Componentes UI Svelte
   - `src/routes/+page.svelte` - Página principal

3. **Commits e PRs:**
   - Commits descritivos usando Conventional Commits
   - PRs com descrição clara das mudanças
   - Sempre atualizar `MEMORIA-PROJETO.md` para decisões importantes

4. **Antes de Qualquer Mudança:**
   - Pergunte-se: "Outro dev entenderá isso em 6 meses?"
   - Documente o "por quê", não apenas o "o quê"
   - Atualize comentários e documentação junto com código

---

**Última atualização:** 2026-02-20
**Versão:** 1.3
**Status:** Épico 1 ✅ — Épico 2 ✅ — Épico 3 ✅ — Épico 4 ✅ — CI + Unit Tests ✅
