# Sessão 5 — 2026-02-18 — Épico 3: Mapa de Locais

**Design:** `locaisVisitados` como campo do `GameStatus`. Schema: `"north": "Forest Path"` (explorado) ou `"north": "nao explorado"`. UI: botão 🗺️ inline + terceira coluna expansível.

**Bugs corrigidos:**
1. Modelo 8B vazando status na resposta visível → instrução explícita no prompt
2. `locaisVisitados` sobrescrito com `{}` → merge aditivo

**Limitação conhecida:** Modelos 8B têm dificuldade com JSON aninhado. Modelos maiores (70B+) funcionam muito melhor.

**Nota:** Épico 3 foi posteriormente removido na Sessão 9 (LocationMap substituído por AI Memory Notes).

**Épico 3 ✅ COMPLETO (depois removido).**
