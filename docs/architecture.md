# Yarner Architecture

## Overview

Yarner is a web-based Z-machine text adventure player with AI assistance. Built as a SvelteKit SPA (adapter-static) with TypeScript. No backend — runs entirely in the browser.

---

## Tech Stack Decisions

### ADR-001: ifvms.js over Parchment.js

**Status:** Accepted

**Context:** The AI assistant needs access to game output to provide contextual help. This requires programmatic control over Z-Machine I/O.

**Decision:** Use ifvms.js instead of Parchment.js.

**Consequences:**
- ifvms.js exposes a full programmatic API for capturing I/O, essential for feeding game output to the AI.
- Parchment.js has no such API; it is designed for direct DOM rendering.
- Caveat: ifvms.js mutates the ArrayBuffer in-place (Z-Machine dynamic memory), so SHA-256 of game data changes after VM execution. This affects save slot identification.

### ADR-002: Custom WebGlk Adapter

**Status:** Accepted

**Context:** The Glk layer bridges Z-Machine I/O to the web UI. A custom implementation is needed for testability and integration with the AI pipeline.

**Decision:** Build a custom Glk adapter on top of ifvms.js.

**Consequences:**
- Testable in Node.js with 100% coverage.
- Handles all Z-Machine I/O bridging to the web UI.
- Decoupled from DOM, enabling headless testing.

### ADR-003: OpenAI-Compatible API (Multi-Provider)

**Status:** Accepted

**Context:** Users may prefer local models (privacy, cost) or hosted providers (convenience, capability). The AI layer should be vendor-agnostic.

**Decision:** Use the OpenAI-compatible chat completions API as the universal interface.

**Consequences:**
- Works with local models (LM Studio, Ollama) and hosted providers (OpenAI, Gemini, OpenRouter).
- Provider presets with auto-detection of model lists via `fetchAvailableModels()`.
- Special handling required: Gemma models do not support the system role — injected as a user/assistant pair instead.
- Provider config persisted in localStorage: `yarner-provider-id`, `yarner-api-url`, `yarner-model`.

### ADR-004: IndexedDB via idb

**Status:** Accepted

**Context:** All game data must persist client-side with no backend. localStorage is insufficient for binary game files and structured data.

**Decision:** Use IndexedDB through the `idb` library.

**Consequences:**
- DB version 3 with 4 object stores:

| Store | Contents |
|-------|----------|
| `gameStatus` | AI memory notes per game |
| `chatHistory` | AI chat messages per game |
| `gameSaves` | Save slots (game state + AI state) |
| `gameLibrary` | Uploaded game files with metadata |

- Save slots include `aiChatMessages` + `aiMemory` for complete restore.

---

## AI Memory System

Replaced the original GameStatus JSON approach. The AI maintains a "notebook" of up to 20 numbered notes.

**Type:** `AIMemory = string[]` — list of numbered notes 1-N (max 20).

**Protocol:**

```
MEMORY_UPDATE_START
ADD Discovered the brass lantern in the cellar
REMOVE 3
UPDATE 1 Revised note about the troll bridge
MEMORY_UPDATE_END
```

- Operations: `ADD text`, `REMOVE N`, `UPDATE N text` (processed sequentially by `applyMemoryOperations()`).
- If the AI does not include the memory block, memory stays unchanged.
- Text-based operations are robust with smaller models — no JSON repair needed.

---

## Race Conditions (Resolved)

The reactive statement `$: if ($isGameLoaded && $currentGameName)` triggers `loadAIStateForGame` from IDB. This creates ordering dependencies between AI state persistence and game state changes.

| Scenario | Resolution |
|----------|-----------|
| Restart | `resetAIStateForRestart()` BEFORE `restartGame()` — persist to IDB first |
| Load slot (in-game) | `restoreAIMemoryFromSave()` BEFORE `loadFromSaveSlot()` — persist to IDB first |
| Load slot (home screen) | `saveAIMemory/saveChatHistory(slot.gameName)` directly — `restoreAIMemoryFromSave()` does not work because `gameState.gameName` is empty |
| New game (upload) | `clearGameAIData()` BEFORE `loadGame()` — clear IDB to avoid stale data |
| Reload from library | `clearGameAIData()` BEFORE `loadGame()` — start fresh |

Additional constraint: `restartGame()` must NOT set `isLoaded=false` to avoid unmounting `GamePanel`/`AIAssistant`.

---

## Validated Games System

A hardcoded map of known game files for display name resolution and verification badges.

- Source: `src/lib/data/validatedGames.ts` — maps SHA-256 to canonical name.
- API: `getValidatedGameName(sha256)`, `isValidatedGame(sha256)`.
- Because ifvms.js mutates the ArrayBuffer in-place, the SHA of `slot.gameData` differs from the original. To resolve a display name from saves, look up the original SHA in the library by `gameName`.
- Unified upload flow: always adds to library first; the player starts from there.
- `displayName` is resolved BEFORE `loadGame()` to avoid a flash of the raw `gameName`.

---

## i18n

- Library: `svelte-i18n` (runtime-based, JSON locale files).
- Languages: PT-BR (default, loaded synchronously to avoid flash) + EN (lazy loaded).
- Auto-detection: `navigator.language`, fallback to PT-BR, persisted in localStorage (`yarner-locale`).
- Selector: cycle button in header (PT-BR / EN).
- Usage: `$t('key')` in `.svelte` files, `get(t)('key')` in `.ts` files.
- The AI system prompt is included in locale files — changing locale changes the AI response language.

---

## Testing

### Unit Tests

- Framework: Vitest with `fake-indexeddb` for browser API mocking.
- 218 tests at 99%+ coverage, enforced by GitHub Actions CI.

### E2E Tests

- Framework: Playwright + playwright-bdd (Gherkin BDD).
- 23 scenarios across 5 feature files, run locally against a production build (`vite preview`).
- Not in CI — contributors run manually for UI changes.

**Structure:**

| Path | Purpose |
|------|---------|
| `e2e/playwright.config.ts` | Config: webServer builds + serves on port 4173 |
| `e2e/fixtures/test-helpers.ts` | `YarnerPage` page object with reusable helpers + API mocking |
| `e2e/fixtures/advent.z3` | Colossal Cave Adventure Z3 test fixture |
| `e2e/features/*.feature` | Gherkin scenarios (game-upload, save-load, game-lifecycle, ai-assistant, settings) |
| `e2e/steps/*.steps.ts` | Step definitions (common + per-feature) |

**API mocking:** Playwright route interception mocks the Gemini models endpoint and OpenAI-compatible chat completions endpoint. No real API keys needed. The `YarnerPage.mockGeminiAPI()` static method sets up all mocks.

**Key patterns:**
- Each scenario starts with `freshStart()` — navigate, clear IndexedDB + localStorage, reload.
- Game upload via `page.setInputFiles()` on the hidden `input.file-input`.
- Onboarding validation triggered by `blur` event on the API key input.
- Save panel auto-closes on success; tests wait for `.save-feedback` visibility.

---

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/zmachine/GameEngine.ts` | VM lifecycle (load, command, save, restore) |
| `src/lib/zmachine/glk/WebGlk.ts` | Glk adapter (testable in Node.js) |
| `src/lib/stores/gameState.ts` | Global game state |
| `src/lib/stores/aiPersistence.ts` | IndexedDB operations (DB v3, 4 stores) |
| `src/lib/stores/aiChat.ts` | AI chat store (provider, messages, memory) |
| `src/lib/api/claude.ts` | API client + provider presets + model fetching + `applyMemoryOperations()` |
| `src/lib/data/validatedGames.ts` | SHA-256 to canonical game name map |
| `src/lib/i18n/index.ts` | svelte-i18n setup, `cycleLocale`, `setLocale` |
| `src/lib/i18n/locales/pt-BR.json` | PT-BR locale (~100+ keys) |
| `src/lib/i18n/locales/en.json` | EN locale (~100+ keys) |
| `src/lib/stores/themeStore.ts` | Theme system (4 themes, localStorage) |
| `src/lib/components/GamePanel.svelte` | Game terminal (typewriter, save overwrite) |
| `src/lib/components/AIAssistant.svelte` | AI panel (settings, debug mode, memory panel) |
| `src/lib/components/GameLibrary.svelte` | Game library on home screen (SHA-256, quick-load, validated badges) |
| `e2e/playwright.config.ts` | E2E test config (Playwright + playwright-bdd) |
| `e2e/fixtures/test-helpers.ts` | `YarnerPage` page object + API mocking |
