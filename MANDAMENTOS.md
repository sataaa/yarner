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
- **Parchment.js** (client-side, 100% browser)
- Suporte inicial: Z-machine v3-8 (.z5, .z8)
- Carregamento via File API do navegador

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

---

## 📁 ESTRUTURA DO PROJETO

```
yarner/
├── MANDAMENTOS.md          # Este arquivo
├── MEMORIA-PROJETO.md      # Memória persistente do projeto
├── README.md               # Documentação do projeto
├── src/
│   ├── routes/            # Páginas SvelteKit
│   ├── lib/
│   │   ├── components/    # GamePanel, AIAssistant, etc
│   │   ├── stores/        # State management (game, IA)
│   │   ├── api/           # Claude API integration
│   │   └── zmachine/      # Parchment.js wrapper
│   └── app.html
├── static/                # Assets estáticos
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

**Última atualização:** 2026-02-11
**Versão:** 1.0
**Status:** Iniciando desenvolvimento
