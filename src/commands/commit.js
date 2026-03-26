import { execSync } from 'node:child_process';
import ora from 'ora';
import chalk from 'chalk';
import { select, input, confirm } from '@inquirer/prompts';
import { generate } from '../core/ollama.js';
import { getConfig } from '../utils/config.js';
import { setupCommand } from './setup.js';
import { ensureOllama } from '../utils/ensure-ollama.js';
import { copyToClipboard } from '../utils/clipboard.js';

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
  const prompt = buildPrompt(diff);

  const spin = ora('Generating commit messages...').start();
  let messages;
  try {
    const raw = await generate(prompt, model);
    messages = parseMessages(raw);
    spin.stop();
  } catch (err) {
    spin.fail('Failed to generate commit messages');
    console.error(chalk.red('✖'), err.message);
    process.exit(1);
  }

  if (messages.length === 0) {
    spin.stop();
    console.error(chalk.red('✖') + ' Model returned empty messages. Try regenerating.');
    process.exit(1);
  }

  console.log('');

  const choices = [
    ...messages.map((msg, i) => ({
      name: `${i + 1}. ${msg}`,
      value: msg,
    })),
    { name: chalk.cyan('↻') + ' Regenerate',     value: '__regenerate__' },
    { name: chalk.dim('✎') + ' Edit manually',   value: '__edit__' },
    { name: chalk.red('✖') + ' Abort',            value: '__abort__' },
  ];

  const picked = await select({
    message: 'Pick a commit message:',
    choices,
  });

  switch (picked) {
    case '__regenerate__':
      await generateAndPrompt(diff, model);
      break;

    case '__edit__': {
      const edited = await editMessage(messages[0]);
      if (edited) {
        doCommit(edited);
        copyToClipboard(edited);
      } else {
        console.log(chalk.yellow('⚠') + ' Empty message — commit cancelled.');
      }
      break;
    }

    case '__abort__':
      console.log(chalk.dim('Commit cancelled.'));
      break;

    default:
      doCommit(picked);
      copyToClipboard(picked);
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
  return `You are a commit message generator. Analyze this git diff and write exactly 3 different commit messages.

STRICT FORMAT: type: description
Each message MUST start with one of these types followed by a colon:
  feat: (new feature)
  fix: (bug fix)
  refactor: (code restructuring)
  docs: (documentation)
  style: (formatting)
  test: (tests)
  chore: (maintenance)

You may optionally include a scope: type(scope): description

Rules:
- Max 100 characters per message
- Lowercase only
- No period at the end
- Do NOT omit the type prefix
- Each message should have a different perspective or focus
- Respond with ONLY the 3 messages, numbered 1. 2. 3. one per line

Example output format:
1. feat(auth): add JWT refresh token rotation
2. refactor(middleware): improve token handling with expiry-based refresh
3. feat(security): implement session token rotation for enhanced auth

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

export function parseMessages(raw) {
  let text = raw.trim();

  // Strip <think>...</think> blocks
  text = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

  // Strip markdown code fences
  const fenceMatch = text.match(/^```[\w]*\n?([\s\S]*?)\n?```$/);
  if (fenceMatch) text = fenceMatch[1].trim();

  // Try to extract numbered lines: "1. ...", "2. ...", "3. ..."
  const numbered = text.match(/^\d+\.\s+.+$/gm);
  if (numbered && numbered.length >= 2) {
    return numbered
      .map(line => cleanMessage(line.replace(/^\d+\.\s+/, '')))
      .filter(msg => msg.length > 0)
      .slice(0, 3);
  }

  // Fallback: split by newlines, clean each
  const lines = text.split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .map(l => cleanMessage(l))
    .filter(msg => msg.length > 0)
    .slice(0, 3);

  if (lines.length > 0) return lines;

  // Last resort: treat as single message
  const single = cleanMessage(text);
  return single ? [single] : [];
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
