<div align="center">

<br>

<p>
  <img alt="loco" src="https://img.shields.io/badge/LOCO-0f172a?style=for-the-badge&label=&color=0f172a">
</p>

<p><strong>local-first commit intelligence</strong></p>

<p><sub>PRIVATE&nbsp;&nbsp;•&nbsp;&nbsp;FAST&nbsp;&nbsp;•&nbsp;&nbsp;LOCAL MODEL READY</sub></p>

<br><br>

<p><strong>Your commit history is engineering infrastructure, not throwaway text.</strong></p>

<p>
  <a href="https://www.npmjs.com/package/loco-ai"><img src="https://img.shields.io/npm/v/loco-ai?style=flat-square&color=cb3837&label=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/loco-ai"><img src="https://img.shields.io/npm/dm/loco-ai?style=flat-square&color=gray&label=downloads" alt="downloads"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D18-339933?style=flat-square&logo=node.js&logoColor=white" alt="node"></a>
  <a href="https://ollama.com"><img src="https://img.shields.io/badge/Ollama-local%20LLM-111827?style=flat-square" alt="ollama"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-22c55e?style=flat-square" alt="license"></a>
</p>

<br>

<p>
  <a href="#quick-start">Quick Start</a>&nbsp;&nbsp;|&nbsp;&nbsp;
  <a href="#the-problem">The Problem</a>&nbsp;&nbsp;|&nbsp;&nbsp;
  <a href="#commands">Commands</a>&nbsp;&nbsp;|&nbsp;&nbsp;
  <a href="#usage">Usage</a>&nbsp;&nbsp;|&nbsp;&nbsp;
  <a href="#models">Models</a>&nbsp;&nbsp;|&nbsp;&nbsp;
  <a href="#configuration">Configuration</a>&nbsp;&nbsp;|&nbsp;&nbsp;
  <a href="#git-hook">Git Hook</a>&nbsp;&nbsp;|&nbsp;&nbsp;
  <a href="#faq">FAQ</a>
</p>

<br>

</div>

---

<br>

**loco** turns Git diffs into **3 high-signal commit drafts** using a local model through [Ollama](https://ollama.com). It is designed for teams that want clearer history, faster reviews, safer incident debugging, and zero source-code exposure to hosted AI tools.

<br>

## The Problem

Bad commit messages look harmless until a team needs the history for something important.

That pain shows up everywhere in software:

- code reviews slow down because intent is missing
- release prep gets messy when change history is vague
- debugging old regressions turns into archaeology
- developers lose focus at the last 30 seconds of a task
- privacy-conscious teams cannot send internal diffs to cloud APIs

`loco` is built for that exact gap. It handles the small but repeated documentation step between “code is done” and “commit is written”, then keeps the whole workflow local.

### What improves with loco?

| Without discipline | With loco |
|---|---|
| Commit messages decay under deadline pressure | The CLI drafts useful commit options from the diff |
| Git history becomes noisy and hard to search | History stays readable and operationally useful |
| Local-first teams avoid AI entirely | AI assistance stays inside the machine |
| Hooks can become brittle and disruptive | Hook mode fails open and stays out of the way |

<br>

## Features

<table>
<tr>
<td width="50%">

**Protect Developer Focus**
<br>Finishing a task should not end with staring at a blank commit prompt. loco drafts the wording so engineers can close work without losing momentum.

</td>
<td width="50%">

**Private By Default**
<br>Runs through your local Ollama runtime. No external API calls, no vendor lock-in, no diff data leaving the machine.

</td>
</tr>
<tr>
<td>

**History That Helps Later**
<br>Outputs conventional commit style messages that remain useful during reviews, release notes, blame sessions, and future maintenance.

</td>
<td>

**Human Review Built In**
<br>You get three drafts, then decide what happens next: choose one, edit one, regenerate, or cancel.

</td>
</tr>
<tr>
<td>

**Fits Existing Team Habits**
<br>Use it as an interactive CLI, as a copy-to-clipboard helper for IDE workflows, or as a Git hook for standard terminal commits.

</td>
<td>

**Practical Hook Mode**
<br>Installs a <code>prepare-commit-msg</code> hook that pre-fills commit text without hijacking merge, squash, or manually supplied messages.

</td>
</tr>
<tr>
<td>

**Low-Friction Setup**
<br>Checks Ollama, starts the local service when possible, and pulls a default model so the first-run experience stays short.

</td>
<td>

**Model Flexibility**
<br>Start with a lightweight default and switch to larger Ollama models whenever your machine or quality bar allows it.

</td>
</tr>
</table>

<br>

## Quick Start

### 1. Install

```sh
npm install -g loco-ai
```

> **Requires:** [Node.js](https://nodejs.org) >= 18 and [Ollama](https://ollama.com)

### 2. Set up Ollama

```sh
# macOS
brew install ollama

# or download the desktop app
# https://ollama.com/download
```

Then run:

```sh
loco setup
```

`loco setup` checks that Ollama is installed, starts the service if necessary, and pulls the default model: `qwen2.5-coder:1.5b`.

### 3. Generate your commit

```sh
git add .
loco commit
```

If you skip `loco setup`, the `commit` and `message` flows can guide you through setup on first use.

<br>

## Commands

| Command | Description |
|---------|-------------|
| `loco commit` | Generate 3 suggestions, pick one, and commit |
| `loco message` | Generate suggestions without committing |
| `loco msg` | Alias for `loco message` |
| `loco setup` | Verify Ollama and pull the default model |
| `loco init` | Install the git hook |
| `loco models` | List installed models and manage them interactively |
| `loco pull <model>` | Pull a model from the Ollama library |
| `loco config` | Show current config and choose the default model |
| `loco config --model <name>` | Set the default model directly |
| `loco doctor` | Run environment health checks |

<br>

## Usage

### Basic workflow

```sh
# Stage your changes
git add src/cli.js src/commands/commit.js

# Generate 3 suggestions and pick one
loco commit
```

**Output:**

```text
? Pick a commit message:
> 1. feat(cli): add interactive commit message selection flow
  2. refactor(commit): simplify local diff analysis before generation
  3. chore(ollama): improve setup flow for local model startup
  ↻ Regenerate
  ✎ Edit manually
  ✖ Abort
```

Instead of forcing engineers to invent phrasing from scratch, loco turns the diff into decision-ready options.

### Generate a message without committing

```sh
git add .
loco msg
```

Pick one of the generated messages and loco copies it to your clipboard so you can paste it into your IDE or Git client.

This mode is especially useful when a team commits through GUI tools but still wants consistent, high-quality commit language.

### Install the git hook

```sh
loco init
git add .
git commit
```

The hook pre-fills the commit message file for regular commits. If you already pass `-m`, or Git is creating a merge, squash, or similar special commit message, loco stays out of the way instead of fighting the workflow.

### Check your environment

```sh
loco doctor
```

This verifies:

- Ollama is installed
- Ollama is running
- Your default model is available
- The current directory is a Git repository

<br>

## Models

`loco` works with any model available through the [Ollama library](https://ollama.com/library). The default is `qwen2.5-coder:1.5b` because commit drafting is a short, focused task where startup speed matters more than heavyweight general reasoning.

| Model | Approx. Size | Speed | Notes |
|-------|--------------|-------|-------|
| `qwen2.5-coder:1.5b` | Small | Fastest | Default, lightweight |
| `llama3.2:1b` | Small | Fast | Good alternative |
| `codellama` | Medium | Medium | More code-oriented |
| `mistral:latest` | Medium | Medium | Stronger language quality |
| `llama3.1` | Large | Slower | Best if you want richer phrasing |

### Pull and switch models

```sh
# Pull a new model
loco pull codellama

# Pick the active model interactively
loco config

# Or set it directly
loco config --model codellama
```

### Browse installed models

```sh
loco models
```

This opens an interactive menu where you can:

- view installed models
- set the active model
- pull another model

<br>

## Configuration

Config is stored at `~/.loco/config.json`.

The configuration surface is intentionally small. `loco` is meant to disappear into the workflow, not become another tool that needs constant tuning.

### Example config

```json
{
  "defaultModel": "qwen2.5-coder:1.5b",
  "setupComplete": true
}
```

### Update config

```sh
# Show current config and choose interactively
loco config

# Set directly
loco config --model llama3.2:1b
```

<br>

## How It Works

```text
git add .  ->  loco commit  ->  Ollama (local)  ->  choose/edit  ->  git commit
```

1. Reads your staged diff first.
2. If nothing is staged, the interactive flow can fall back to the current Git diff.
3. Large diffs are truncated to roughly 4000 characters before sending them to the model.
4. The prompt asks the local model for exactly 3 conventional commit suggestions.
5. You select one, edit it, regenerate, or cancel.
6. On approval, loco runs `git commit -m ...`.

With `loco init`, the hook flow is slightly different: Git hands loco the commit message file, and loco writes the first generated suggestion into it without blocking commits on failure.

The core idea is simple: if commit quality drops because writing them is tedious, the fix is to reduce the friction without removing human judgment.

<br>

## Git Hook

Install loco as a `prepare-commit-msg` hook:

```sh
loco init
```

After that:

```sh
git add .
git commit
```

Your editor opens with a generated commit message already filled in.

> **Note:** The hook intentionally skips commits that already have a message, such as `git commit -m "..."`, merge commits, squash commits, and similar non-standard commit flows.

<br>

## FAQ

<details>
<summary><strong>Why does this solve a real engineering problem?</strong></summary>
<br>

Because commit messages are not cosmetic. They affect review speed, release traceability, bug forensics, and team communication. Most teams know this, but under pressure they still ship weak messages. loco makes the better default faster than the rushed one.

</details>

<details>
<summary><strong>Does it send my code to the cloud?</strong></summary>
<br>

No. loco talks only to your local Ollama instance at `http://localhost:11434`.

</details>

<details>
<summary><strong>Do I need an API key?</strong></summary>
<br>

No. If Ollama is installed and a model is available, that's enough.

</details>

<details>
<summary><strong>What happens if Ollama is not running?</strong></summary>
<br>

loco tries to start `ollama serve` automatically. If that fails, it tells you how to start Ollama manually.

</details>

<details>
<summary><strong>What if the suggestions are too generic?</strong></summary>
<br>

Choose another draft, regenerate, or edit manually. The product is designed to shorten the wording step, not to force an opaque one-shot answer.

</details>

<details>
<summary><strong>Can I use it without committing?</strong></summary>
<br>

Yes. `loco message` and `loco msg` generate suggestions without creating a commit and copy the selected message to your clipboard.

</details>

<details>
<summary><strong>Will the hook ever block my commit?</strong></summary>
<br>

No. The hook is designed to fail silently so normal Git usage keeps working even if generation fails.

</details>

<br>

## Requirements

- **Node.js** >= 18
- **Git**
- **Ollama**
- An Ollama model such as `qwen2.5-coder:1.5b`

<br>

## License

MIT

<br>

<div align="center">
  <br>
  <p>
    <sub>Built by <a href="https://github.com/oguzcihan"><strong>Oğuzhan Cihan</strong></a></sub>
  </p>
  <p>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-22c55e?style=flat-square" alt="MIT License"></a>
  </p>
  <br>
</div>
