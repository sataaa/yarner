# Sessão 12 — i18n da UI (PT-BR + EN)

**Data:** 2026-03-01

## O que foi feito

### i18n com svelte-i18n
- Instalado `svelte-i18n` como dependência
- Criado módulo `src/lib/i18n/index.ts` com setup, `cycleLocale()`, `setLocale()`, helpers
- Criados arquivos de locale: `src/lib/i18n/locales/pt-BR.json` e `en.json` (~100+ keys cada)
- Chaves organizadas por domínio: `common`, `header`, `game`, `ai`, `upload`, `library`, `errors`, `systemPrompt`
- Locale padrão (PT-BR) carregado sync via inline import (sem flash)
- EN carregado lazy via dynamic import

### Componentes atualizados
- `+page.svelte` — botão de idioma no header, strings via `$t()`
- `GamePanel.svelte` — ~40 strings extraídas, datas com `$locale`
- `AIAssistant.svelte` — ~25 strings extraídas, hints via keys individuais
- `FileUploader.svelte` — ~15 strings extraídas
- `GameLibrary.svelte` — ~10 strings extraídas, datas com `$locale`

### Arquivos .ts atualizados
- `claude.ts` — system prompt, error messages, Gemma workaround via `get(t)`
- `gameState.ts` — error messages, restore notification via `get(t)`

### Melhorias de UX (pré-i18n)
- Highlight de duplicata: flash de fundo em vez de borda
- Mensagem "Já na biblioteca" inline no card (removido banner do topo)
- FileUploader reseta após upload (novo método `reset()`)
- Painéis de salvar/carregar com toggle (clique abre/fecha)

### Testes
- 217 testes passando (17 novos)
- Testes de i18n: cycle, setLocale, getLocaleLabel, getLocaleIcon, key parity entre locales
- Setup file `src/lib/i18n/test-setup.ts` inicializa svelte-i18n nos testes
- Vitest `setupFiles` configurado em `vitest.config.ts`

## Decisões técnicas

1. **svelte-i18n** escolhido por: API `$t()` familiar, JSON locale files (fácil contribuição), suporte a interpolação ICU, maduro na comunidade Svelte.
2. **Locale padrão sync** — `register('pt-BR', () => Promise.resolve(ptBR))` com import estático elimina flash de conteúdo não-traduzido.
3. **`get(t)` em .ts files** — fora de componentes Svelte, `$t` auto-subscription não funciona; usa-se `get(t)` do svelte/store.
4. **System prompt no locale file** — traduzir o prompt muda o idioma de resposta da IA automaticamente.
5. **Provider "Personalizado" → "Custom"** — nome no preset mudou para inglês; tradução feita no template do dropdown.
6. **Hints como keys individuais** — `ai.hints.whereAmI` etc. em vez de array, porque `$t()` retorna string, não array.
7. **Separação i18n UI vs docs** — documentação em inglês fica para sessão 13+ (épico B separado).
