# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`loco` (npm: `loco-ai`) — A fully local AI commit message generator. Uses Ollama to run LLMs locally. No cloud, no API keys. Default model: `qwen3.5:0.8b`.

## Commands

- `npm install` — install dependencies
- `npm test` — run tests (vitest)
- `node bin/loco.js <command>` — run CLI during development

## Architecture

Node.js CLI (ESM, `"type": "module"`). Requires Node >= 18 for native `fetch`.

- `bin/loco.js` — shebang entry point, imports `src/cli.js`
- `src/cli.js` — commander program, registers all subcommands
- `src/commands/` — one file per CLI command (setup, commit, message, init, config, models, doctor, hook-run)
- `src/core/ollama.js` — Ollama REST API client (raw fetch against `localhost:11434`, no SDK)
- `src/utils/config.js` — reads/writes `~/.loco/config.json`
- `src/utils/ensure-ollama.js` — checks Ollama binary + service, auto-starts if needed, shows install guide if missing

## Key Data Flows

**`loco commit`**: check setup (prompt if needed) → ensure Ollama running (auto-start) → get staged diff (truncate at 4K chars) → `POST /api/generate` → display + confirm/edit/regenerate → `git commit -m`

**`loco message`** (alias `loco msg`): same generation flow as commit but message-only — approve (copy to clipboard), regenerate, or cancel. No commit is made.

**`loco commit --hook <file>`**: same generation flow but non-interactive — writes message to file, exits 0 on any failure (never blocks git)

**`loco setup`**: check ollama installed → check server running → `POST /api/pull` (streaming progress) → save config

**First-run flow**: if `setupComplete` is false, `loco commit` and `loco message` prompt the user to run setup inline. `ensureOllama()` runs on every invocation — if binary is missing it shows platform-specific install instructions, if service is down it auto-starts via `ollama serve`.

## Conventions

- Ollama API: raw `fetch`, no SDK. Endpoints: `/api/tags`, `/api/generate`, `/api/pull`
- Config stored at `~/.loco/config.json` (user-level, not per-project)
- Git hook: `prepare-commit-msg` (runs before editor, user can still edit)
- Hook failures must always exit 0 to avoid blocking normal git usage
- Prompt uses few-shot examples to enforce conventional commit format (`type: description`)
