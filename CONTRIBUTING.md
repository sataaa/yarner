# Contributing to Yarner

Thank you for your interest in contributing to Yarner. This guide covers the workflow, standards, and expectations for all contributions.

## How to Contribute

1. Fork the repository and clone it locally.
2. Create a branch from `main`.
3. Make your changes, write tests, and verify everything passes.
4. Open a pull request with a clear description of what you changed and why.

## Development Setup

**Prerequisites:** Node.js 18+

```bash
npm install
npm run dev
```

## Development Workflow

1. **Branch from main.** Use a descriptive branch name (e.g., `feat/save-slots`, `fix/glk-output`).
2. **Make your changes.** Keep commits focused and atomic.
3. **Write tests.** 95%+ coverage is required. Every new module with business logic must have unit tests.
4. **Run tests locally** before pushing:
   ```bash
   npm test
   npm run test:coverage
   ```
5. **Commit with Conventional Commits:**
   - `feat:` — new feature
   - `fix:` — bug fix
   - `docs:` — documentation only
   - `refactor:` — code change that neither fixes a bug nor adds a feature
   - `test:` — adding or updating tests
   - `chore:` — maintenance, dependencies, CI config
6. **Open a PR** with a clear description of what changed and why. Link related issues if applicable.

## Code Guidelines

- **Comments explain "why", not "what".** The code should be readable on its own; comments provide context that the code cannot.
- **Keep it simple.** Avoid premature abstraction and over-engineering. Prefer the straightforward solution.
- **TypeScript strict mode.** All code must pass strict type checking.
- **Write for humans.** Code should be clear to a developer reading it six months from now.

## Testing Requirements

- Every new module with business logic **must** have unit tests.
- **95%+ coverage** is enforced by CI. Your PR will be blocked if coverage drops below this threshold.
- Use **mocks** for external dependencies (APIs, browser APIs, IndexedDB).
- **Test behavior, not implementation.** Tests should verify what the code does, not how it does it internally.
- Run the full suite locally:
  ```bash
  npm test
  npm run test:coverage
  ```

## CI Pipeline

GitHub Actions runs on every pull request. The following gates must pass before a PR can be merged:

- Build succeeds
- All tests pass
- Coverage meets the 95%+ threshold

No broken code reaches `main`. These checks are mandatory and non-negotiable.

## Architecture

For technical decisions and architectural context, see [docs/architecture.md](docs/architecture.md).
