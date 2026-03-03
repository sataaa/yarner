# Sessão 11 — Jogos Validados, Upload Unificado, Sobrescrita de Saves

**Data:** 2026-03-01

## O que foi feito

### Jogos Validados
- Novo arquivo `src/lib/data/validatedGames.ts` com mapa SHA-256 → nome canônico
- Dois jogos na lista: Zork I e Zork II
- Badge ✓ verde na biblioteca para jogos validados
- Nome canônico exibido na biblioteca e no título in-game (GamePanel)

### Upload Unificado
- Upload agora adiciona à biblioteca sem iniciar o jogo — jogador inicia clicando na biblioteca
- Upload duplicado mostra banner "Este jogo já está na sua biblioteca" + highlight com flash CSS no jogo existente
- Layout side-by-side: FileUploader à esquerda, GameLibrary à direita (responsivo: empilha em telas pequenas)

### Sobrescrita de Saves
- Botão rápido no painel de save: "Salvar em [nome-do-slot]" quando existe um último slot carregado/salvo
- Confirmação inline antes de sobrescrever
- `lastSlotName` usa `bind:` para sobreviver ao remount do GamePanel (causado pelo flash de `isLoaded` no `loadFromSaveSlot`)

### Bug fixes
- Null check no scroll do AIAssistant (scrollHeight de container null ao desmontar)
- Carregar da biblioteca agora limpa AI data (começar do zero)

## Decisões técnicas

1. **ifvms.js muta o ArrayBuffer in-place** — SHA do `slot.gameData` difere do original. Solução: buscar SHA original na biblioteca pelo `gameName` em vez de recomputar do gameData do slot.
2. **displayName resolvido ANTES de loadGame** — evita flash do gameName no título do GamePanel.
3. **`bind:lastSlotName`** — valor bidirecional entre +page.svelte e GamePanel para sobreviver ao remount.

## Testes
- 200 testes passando (7 novos para validatedGames)
- 99%+ coverage mantida
