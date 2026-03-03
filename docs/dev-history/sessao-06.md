# Sessão 6 — 2026-02-18 — Épico 4: Save/Load

**Abordagem:** Save externo via `do_autosave`/`do_autorestore` do ifvms.js (botões externos, sem usar o comando "save" do jogo).

**Detalhe crítico:** Após `do_autorestore`, o VM não re-executa `glk_request_line_event_uni`, então `pendingInputBuffer` fica null. Fix: `glk.pendingInputBuffer = vm.read_data.buffer` manualmente. Também necessário: `win.linebuf = buffer` em `glk_request_line_event_uni` para que o `do_autorestore` encontre o buffer.

**`gameData`** (ArrayBuffer do .z5) é salvo no slot para restore cross-session sem o usuário recarregar o arquivo.

✅ Testado com Zork I. Save e Load funcionando.
