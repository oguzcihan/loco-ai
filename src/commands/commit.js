import { execSync } from 'node:child_process';
import ora from 'ora';
import chalk from 'chalk';
import { select, input, confirm } from '@inquirer/prompts';
import { generate } from '../core/ollama.js';
import { getConfig } from '../utils/config.js';
import { setupCommand } from './setup.js';
import { ensureOllama } from '../utils/ensure-ollama.js';

const MAX_DIFF_CHARS = 4000;

export async function commitCommand() {
  // Step 1: Check setup
  let config = getConfig();
  if (!config.setupComplete) {
    console.log(chalk.yellow('⚠') + ' loco is not set up yet.');
    const runSetup = await confirm({ message: 'Run setup now?', default: true });
    if (!runSetup) {
      console.log(chalk.dim('Run ' + chalk.cyan('loco setup') + ' when you are ready.'));
      process.exit(0);
    }
    await setupCommand();
    config = getConfig();
  }

  // Step 2: Ensure Ollama is running
  await ensureOllama();

  // Step 3: Get diff
  const diff = getDiff();
  if (!diff) {
    console.error(chalk.red('✖') + ' No changes detected. Stage your files first.');
    console.error(chalk.dim('  git add <files>'));
    process.exit(1);
  }

  // Truncate large diffs
  let truncated = false;
  let diffText = diff;
  if (diff.length > MAX_DIFF_CHARS) {
    diffText = diff.slice(0, MAX_DIFF_CHARS) + '\n\n[... diff truncated]';
    truncated = true;
  }

  if (truncated) {
    console.log(chalk.yellow('⚠') + ' Diff is large — truncated to 4000 chars for the model.');
  }

  await generateAndPrompt(diffText, config.defaultModel);
}

async function generateAndPrompt(diff, model) {
  // Step 3 + 4: Build prompt and generate
  const prompt = buildPrompt(diff);

  const spin = ora('Generating commit message...').start();
  let message;
  try {
    const raw = await generate(prompt, model);
    message = cleanMessage(raw);
    spin.stop();
  } catch (err) {
    spin.fail('Failed to generate commit message');
    console.error(chalk.red('✖'), err.message);
    process.exit(1);
  }

  if (!message) {
    spin.stop();
    console.error(chalk.red('✖') + ' Model returned an empty message. Try regenerating.');
    process.exit(1);
  }

  // Step 5: Display in a box
  printMessageBox(message);

  // Step 6: Ask user what to do
  const action = await select({
    message: 'What would you like to do?',
    choices: [
      { name: 'Use this message',       value: 'use' },
      { name: 'Edit before committing',  value: 'edit' },
      { name: 'Regenerate',              value: 'regenerate' },
      { name: 'Cancel',                  value: 'cancel' },
    ],
  });

  switch (action) {
    case 'use':
      doCommit(message);
      break;

    case 'edit': {
      const edited = await editMessage(message);
      if (edited) {
        doCommit(edited);
      } else {
        console.log(chalk.yellow('⚠') + ' Empty message — commit cancelled.');
      }
      break;
    }

    case 'regenerate':
      await generateAndPrompt(diff, model);
      break;

    case 'cancel':
      console.log(chalk.dim('Commit cancelled.'));
      break;
  }
}

export function getDiff() {
  // Try staged changes first
  try {
    const staged = execSync('git diff --staged', { encoding: 'utf-8' }).trim();
    if (staged) return staged;
  } catch {
    // not a git repo or git not installed
    console.error(chalk.red('✖') + ' Not a git repository.');
    process.exit(1);
  }

  // Fall back to unstaged changes
  try {
    const unstaged = execSync('git diff HEAD', { encoding: 'utf-8' }).trim();
    if (unstaged) return unstaged;
  } catch {
    // HEAD might not exist (empty repo), ignore
  }

  return '';
}

export function buildPrompt(diff) {
  return `You are a commit message generator. Analyze this git diff and write ONE commit message.

STRICT FORMAT: type: description
The message MUST start with one of these types followed by a colon:
  feat: (new feature)
  fix: (bug fix)
  refactor: (code restructuring)
  docs: (documentation)
  style: (formatting)
  test: (tests)
  chore: (maintenance)

You may optionally include a scope: type(scope): description

Rules:
- Max 100 characters total
- Lowercase only
- No period at the end
- Respond with ONLY the commit message, nothing else
- Do NOT omit the type prefix

Good examples:
  feat: add user authentication endpoint
  fix(api): handle null response from external service
  refactor: extract validation logic into shared util

Bad examples (NEVER do this):
  Add new endpoint for stats data
  Updated the login page

Git diff:
${diff}`;
}

export function cleanMessage(raw) {
  let msg = raw.trim();

  // Strip <think>...</think> blocks (qwen3.5 and other reasoning models)
  msg = msg.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

  // Strip markdown code fences
  const fenceMatch = msg.match(/^```[\w]*\n?([\s\S]*?)\n?```$/);
  if (fenceMatch) msg = fenceMatch[1].trim();

  // Strip surrounding quotes
  if ((msg.startsWith('"') && msg.endsWith('"')) || (msg.startsWith("'") && msg.endsWith("'"))) {
    msg = msg.slice(1, -1);
  }

  // Take only the first line if model was chatty
  msg = msg.split('\n')[0].trim();

  // Remove trailing period
  if (msg.endsWith('.')) msg = msg.slice(0, -1);

  return msg;
}

export function printMessageBox(message) {
  const pad = 2;
  const inner = message.length + pad * 2;
  const border = chalk.dim;

  console.log('');
  console.log(border('  ┌' + '─'.repeat(inner) + '┐'));
  console.log(border('  │') + ' '.repeat(pad) + chalk.green(message) + ' '.repeat(pad) + border('│'));
  console.log(border('  └' + '─'.repeat(inner) + '┘'));
  console.log('');
}

function doCommit(message) {
  try {
    // Use -- to prevent message being interpreted as flags
    execSync(`git commit -m "${message.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/`/g, '\\`')}"`, {
      stdio: 'inherit',
    });
    console.log(chalk.green('✔') + ' Committed!');
  } catch {
    console.error(chalk.red('✖') + ' git commit failed.');
    process.exit(1);
  }
}

async function editMessage(original) {
  // Try $EDITOR if set
  if (process.env.EDITOR) {
    const { writeFileSync, readFileSync, unlinkSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');

    const tmpFile = join(tmpdir(), `loco-ai-${Date.now()}.txt`);
    writeFileSync(tmpFile, original);

    try {
      execSync(`${process.env.EDITOR} "${tmpFile}"`, { stdio: 'inherit' });
      const edited = readFileSync(tmpFile, 'utf-8').trim();
      unlinkSync(tmpFile);
      return edited;
    } catch {
      try { unlinkSync(tmpFile); } catch { /* ignore */ }
      // Fall through to inline input
    }
  }

  // Inline input fallback
  const edited = await input({
    message: 'Edit commit message:',
    default: original,
  });

  return edited.trim();
}
