# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build / Test / Lint Commands

```bash
npm run electron:dev    # Build main/preload/renderer + launch Electron
npm run build           # Full build: tsc + vite
npm run dev             # Vite dev server only (renderer, no Electron)

npm test                # vitest watch mode
npm run test:run        # vitest single run
npm run test:coverage   # vitest with coverage

npm run lint            # ESLint check
npm run lint:fix        # ESLint auto-fix
npm run format          # Prettier

# Single test file:
npx vitest run src/path/to/__tests__/Foo.test.ts
```

## Architecture

OpenCowork is an **Electron desktop app** (AI agent runtime) with three compilation targets:

| Target | tsconfig | Module | Entry |
|--------|----------|--------|-------|
| Main process (Node) | `tsconfig.main.json` | Node16 | `src/main/index.ts` |
| Preload (Node, limited) | `tsconfig.preload.json` | CommonJS | `src/preload/index.ts` |
| Renderer (browser) | `tsconfig.json` (default) | ESNext | `src/renderer/index.html` (+ preview.html, toolbar.html) |

**Renderer ↔ Main IPC**: Renderer calls `window.electron.invoke(channel, data)` and `window.electron.on(channel, callback)`, defined in preload via `contextBridge`. All IPC handlers live in `src/main/ipcHandlers.ts` (~3100 lines — the central wiring hub).

**Directory layout**:
```
src/
  main/          # Electron main process (index.ts, ipcHandlers.ts, SessionManager, window management)
  preload/       # contextBridge IPC exposure
  renderer/      # React UI — components/, stores/ (Zustand), i18n/, styles/
  core/          # Business logic: action/, executor/, planner/, runtime/, task/, visual/, benchmark/
  agents/        # LangGraph-based agent (mainAgent.ts) + subagents
  visual/        # Hybrid CUA: visual protocol, adapters, runtime, policy
  llm/           # LLM client (OpenAIResponses.ts, config.ts)
  mcp/           # MCP client & server
  tools/         # Agent tools: mcp/, scheduler/, skill/, webfetch/, websearch/
  im/            # Feishu IM integration
  scheduler/     # Cron/interval task scheduling
  history/       # SQLite-backed task history
  memory/        # Agent memory system
  skills/        # Reusable skill modules
  browser/       # Browser observer utilities
  preview/       # Preview/BrowserView management
  shared/        # Shared types including protocol definitions
  config/        # Runtime config readers (settings, imConfig, etc.)
  checkpointers/ # LangGraph checkpoint persistence
  recovery/      # Error recovery engine
  ipc/           # IPC channel definitions
```

**Key patterns**:
- **State**: Zustand stores in `src/renderer/stores/` (taskStore, sessionStore, historyStore, settingsStore, etc.)
- **Agent**: LangGraph ReAct agent (`src/agents/mainAgent.ts`). Browser automation uses Playwright via `playwright-extra` + stealth plugin.
- **Actions**: Each action type extends `BaseAction` with an `ActionType` enum discriminator (`src/core/action/ActionSchema.ts`). Executors route via `ExecutorRouter`.
- **Task lifecycle**: `TaskEngine` drives step execution. `PlanExecutor` handles plan execution with wait/resume/cancel. A `TaskOrchestrator` and unified `TaskRun`/`TaskResult` model is being introduced.
- **Config**: `config/` directory is **git-ignored**. Contains `llm.json` (model provider/API key), `task-runs.json`, `task-results.json`. Never commit.
- **Path alias**: `@/` maps to `src/` for imports.

## Code Conventions

- **Files**: PascalCase for components, camelCase for utilities
- **Classes**: PascalCase; interfaces without `I` prefix
- **Functions**: camelCase, verb-first; booleans prefixed `is*`/`has*`/`can*`
- **Imports**: Named exports preferred. Group: external → internal → relative
- **Errors**: Use custom error codes with `recoverable: boolean`. Log with `[ClassName]` prefix.
- **Tests**: Colocated `__tests__/` directories. Framework: vitest + @testing-library/react.
- **ESLint**: `no-console: warn`, `@typescript-eslint/no-explicit-any: warn`

## Review Context — AI Device Deployment

This is an **AI-dedicated device** scenario. Security priorities are different from web apps:

- **P0 (critical)**: memory leaks, uncaught exceptions (process crash → `app.exit(1)`), resource leaks (missing `cleanup()`), stuck tasks with no timeout
- **P1 (high)**: race conditions, data corruption, missing JSON.parse try-catch
- **P2 (medium)**: type safety, code quality

**Ignore**: CLI injection, path traversal, XSS (single-user desktop app), SQL injection (internal data).

Shell dangerous commands (`rm -rf`, `cat *`) are acceptable in this deployment context.

## Additional Guidelines

See `AGENTS.md` for detailed code style guidelines, testing patterns, logging conventions, and historical audit/fix records. See `docs/ARCHITECTURE.md` for architecture direction and target state.
