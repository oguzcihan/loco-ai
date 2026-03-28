# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`loco` (npm: `loco-ai`) — A fully local AI commit message generator. Uses Ollama to run LLMs locally. No cloud, no API keys. Default model: `qwen2.5-coder:1.5b`.

## Commands

- `npm install` — install dependencies
- `npm test` — run tests (vitest)
- `node bin/loco.js <command>` — run CLI during development

## Architecture

Node.js CLI (ESM, `"type": "module"`). Requires Node >= 18 for native `fetch`.

- `bin/loco.js` — shebang entry point, imports `src/cli.js`
- `src/cli.js` — commander program, registers all subcommands, reads version from package.json
- `src/commands/` — one file per CLI command (setup, commit, message, init, config, models, doctor, hook-run, pull)
- `src/core/ollama.js` — Ollama REST API client (raw fetch against `localhost:11434`, no SDK). Uses low temperature (0.3) and seed for deterministic output.
- `src/core/git.js` — git operations: getDiff (staged then unstaged fallback), getRecentCommits, truncateDiff, ensureGitRepo
- `src/core/convention-detector.js` — analyzes git history to detect commit convention (conventional, ticket-prefixed, imperative)
- `src/core/prompt-builder.js` — convention-aware prompt construction with commit/message mode support
- `src/core/message-parser.js` — parse, normalize, validate LLM output; formatLongMessage for subject+body split
- `src/utils/config.js` — reads/writes `~/.loco/config.json`
- `src/utils/ensure-ollama.js` — checks Ollama binary + service, auto-starts if needed
- `src/utils/setup-guard.js` — strict setup check, exits with error if setup not complete

## Key Data Flows

**`loco commit`**: requireSetup() → ensureOllama() → ensureGitRepo() → getDiff (staged, then unstaged fallback) → truncateDiff → getRecentCommits → detectConvention → buildPrompt (convention-aware) → generate → parseMessages → normalizeMessage → display + confirm/edit/regenerate → `git commit -m`

**`loco message`** (alias `loco msg`): same flow as commit but message-mode prompt (allows multi-line) → formatLongMessage → copy to clipboard. No commit is made.

**`loco commit --hook <file>`**: same generation flow but non-interactive — convention-aware, writes normalized message to file, exits 0 on any failure (never blocks git)

**`loco setup`**: guided Ollama install (OS detection, user confirmation, auto-install) → check server running → `POST /api/pull` (streaming progress) → save config with setupComplete: true

**First-run flow**: if `setupComplete` is false, `loco commit` and `loco message` fail with "Setup required. Please run: loco setup" (exit 1). No interactive prompt — strict gating.

## Conventions

- Ollama API: raw `fetch`, no SDK. Endpoints: `/api/tags`, `/api/generate`, `/api/pull`
- Config stored at `~/.loco/config.json` (user-level, not per-project)
- Git hook: `prepare-commit-msg` (runs before editor, user can still edit)
- Hook failures must always exit 0 to avoid blocking normal git usage
- Prompt adapts to repo's commit convention (detected from git history); falls back to conventional commit format
- Output is normalized post-generation: lowercase for conventional, truncated at 100 chars, type prefix enforced
- Tests in `test/` directory, run with `npm test` (vitest)
