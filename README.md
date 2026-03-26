# loco

Local AI commit messages. No API keys. No cloud.

loco generates conventional commit messages from your staged changes using a local LLM through [Ollama](https://ollama.com). Everything runs on your machine.

## Install

```bash
npm install -g loco-ai
```

Requires [Node.js](https://nodejs.org) >= 18 and [Ollama](https://ollama.com).

## Quick start

```bash
npm install -g loco-ai
git add .
loco commit                # first run will guide you through setup automatically
```

No need to run setup separately — if Ollama is missing or not running, loco will detect it and walk you through each step.

## Commands

| Command | Description |
|---------|-------------|
| `loco setup` | Check Ollama, pull default model, mark ready |
| `loco commit` | Generate commit message from staged diff, review, and commit |
| `loco message` | Generate commit message only (copies to clipboard). Alias: `loco msg` |
| `loco init` | Install git hook so `git commit` uses loco |
| `loco config` | Change the active model (interactive or `--model`) |
| `loco models` | List installed Ollama models |
| `loco doctor` | Health check — verify everything works |

### Message-only mode

Use `loco message` (or `loco msg`) to generate a commit message without committing. You can approve (copies to clipboard), regenerate, or cancel.

```bash
git add .
loco msg                   # generate, approve → copied to clipboard, paste in IDE
```

### Git hook mode

Run `loco init` once in a repo. After that, every `git commit` will pre-fill the editor with an AI-generated message. You can edit it before saving.

```bash
loco init
git add .
git commit                 # message auto-generated, opens in your editor
```

## How it works

1. `loco commit` reads your `git diff --staged`
2. If Ollama is not installed, loco shows platform-specific install instructions
3. If Ollama is installed but not running, loco starts it automatically
4. The diff is sent to a local LLM running through Ollama (`localhost:11434`)
5. The model generates a conventional commit message (`feat:`, `fix:`, etc.)
6. You review, edit, or regenerate before committing

No data leaves your machine. Ollama runs the model locally using your CPU/GPU.

## Supported models

Any model available through Ollama works. The default is `qwen3.5:0.8b` — small, fast, and good enough for commit messages.

Change models anytime:

```bash
loco config --model mistral:latest
loco config --model llama3.2:1b
loco config                # interactive picker
```

Browse all available models at [ollama.com/library](https://ollama.com/library).

## Author

Oğuzhan Cihan

## License

MIT
