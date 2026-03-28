import { execSync } from 'node:child_process';
import ora from 'ora';
import chalk from 'chalk';
import { select, input } from '@inquirer/prompts';
import { generate } from '../core/ollama.js';
import { ensureOllama } from '../utils/ensure-ollama.js';
import { copyToClipboard } from '../utils/clipboard.js';
import { buildMessageChoices } from '../utils/prompt-choices.js';
import { requireSetup } from '../utils/setup-guard.js';
import { ensureGitRepo, getDiff, getRecentCommits, compressDiff } from '../core/git.js';
import { detectConvention } from '../core/convention-detector.js';
import { buildPrompt } from '../core/prompt-builder.js';
import { parseMessages, normalizeMessage } from '../core/message-parser.js';

export async function commitCommand() {
  const config = requireSetup();

  await ensureOllama();

  try {
    ensureGitRepo();
  } catch {
    console.error(chalk.red('\u2716') + ' Not a git repository.');
    process.exit(1);
  }

  const diff = getDiff();
  if (!diff) {
    console.error(chalk.red('\u2716') + ' No changes detected. Stage your files first.');
    console.error(chalk.dim('  git add <files>'));
    process.exit(1);
  }

  const { diff: diffText, wasCompressed } = compressDiff(diff);
  if (wasCompressed) {
    console.log(chalk.yellow('\u26a0') + ' Diff is large \u2014 compressed for the model (noise files filtered, large files summarized).');
  }

  const commits = getRecentCommits(50);
  const convention = detectConvention(commits);

  await generateAndPrompt(diffText, config.defaultModel, convention);
}

async function generateAndPrompt(diff, model, convention) {
  const prompt = buildPrompt(diff, convention, 'commit');

  const spin = ora('Generating commit messages...').start();
  let messages;
  try {
    const raw = await generate(prompt, model);
    messages = parseMessages(raw)
      .map(msg => normalizeMessage(msg, convention))
      .filter(msg => msg.length > 0);
    spin.stop();
  } catch (err) {
    spin.fail('Failed to generate commit messages');
    console.error(chalk.red('\u2716'), err.message);
    process.exit(1);
  }

  if (messages.length === 0) {
    spin.stop();
    console.error(chalk.red('\u2716') + ' Model returned empty messages. Try regenerating.');
    process.exit(1);
  }

  console.log('');

  const { choices, pageSize } = buildMessageChoices(messages, [
    { name: chalk.cyan('\u21bb') + ' Regenerate',     value: '__regenerate__' },
    { name: chalk.dim('\u270e') + ' Edit manually',   value: '__edit__' },
    { name: chalk.red('\u2716') + ' Abort',            value: '__abort__' },
  ]);

  const picked = await select({
    message: 'Pick a commit message:',
    choices,
    pageSize,
  });

  switch (picked) {
    case '__regenerate__':
      await generateAndPrompt(diff, model, convention);
      break;

    case '__edit__': {
      const edited = await editMessage(messages[0]);
      if (edited) {
        doCommit(edited);
        copyToClipboard(edited);
      } else {
        console.log(chalk.yellow('\u26a0') + ' Empty message \u2014 commit cancelled.');
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

function doCommit(message) {
  try {
    execSync(`git commit -m "${message.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/`/g, '\\`')}"`, {
      stdio: 'inherit',
    });
    console.log(chalk.green('\u2714') + ' Committed!');
  } catch {
    console.error(chalk.red('\u2716') + ' git commit failed.');
    process.exit(1);
  }
}

async function editMessage(original) {
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
    }
  }

  const edited = await input({
    message: 'Edit commit message:',
    default: original,
  });

  return edited.trim();
}
