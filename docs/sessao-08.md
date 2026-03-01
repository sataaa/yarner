# Sessão 8 — 2026-02-21 — Testes, CI e Refatoração

**PR 4 — README reescrito:**
- Removidas todas as referências ao Parchment.js
- Diagrama Mermaid substituindo o ASCII box diagram
- Documentação da arquitetura real (v0.4.0-alpha)

**PR 5 — Testes unitários + CI:**
- 40 testes unitários em 3 arquivos (claude.ts, aiPersistence.ts, gameState.ts)
- GitHub Actions CI — bloqueia merge se build ou testes falharem; coverage mínimo enforced: 95%
- BMAD instalado no projeto

**PR 6 — Refatoração zvm-wrapper → módulos testáveis:**
- `zvm-wrapper.ts` deletado (829 linhas)
- `src/lib/zmachine/glk/types.ts` — tipos compartilhados
- `src/lib/zmachine/glk/WebGlk.ts` — adaptador Glk sem dependência do ZVM (testável em Node.js)
- `src/lib/zmachine/glk/WebGlk.test.ts` — 76 novos testes
- `src/lib/zmachine/GameEngine.ts` — ciclo de vida do VM
- 159 testes passando, 98.34% branch coverage; WebGlk.ts e types.ts em 100%
