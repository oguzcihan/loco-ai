import ora from 'ora';
import chalk from 'chalk';
import { select, confirm } from '@inquirer/prompts';
import { generate } from '../core/ollama.js';
import { getConfig } from '../utils/config.js';
import { setupCommand } from './setup.js';
import { ensureOllama } from '../utils/ensure-ollama.js';
import { copyToClipboard } from '../utils/clipboard.js';
import { getDiff, buildPrompt, parseMessages } from './commit.js';

const MAX_DIFF_CHARS = 4000;

export async function messageCommand() {
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

  await ensureOllama();

  const diff = getDiff();
  if (!diff) {
    console.error(chalk.red('✖') + ' No changes detected. Stage your files first.');
    console.error(chalk.dim('  git add <files>'));
    process.exit(1);
  }

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
    console.error(chalk.red('✖') + ' Model returned empty messages. Try again.');
    process.exit(1);
  }

  console.log('');

  const choices = [
    ...messages.map((msg, i) => ({
      name: `${i + 1}. ${msg}`,
      value: msg,
    })),
    { name: chalk.cyan('↻') + ' Regenerate', value: '__regenerate__' },
    { name: chalk.red('✖') + ' Abort',       value: '__abort__' },
  ];

  const picked = await select({
    message: 'Pick a commit message:',
    choices,
  });

  switch (picked) {
    case '__regenerate__':
      await generateAndPrompt(diff, model);
      break;

    case '__abort__':
      console.log(chalk.dim('Cancelled.'));
      break;

    default:
      copyToClipboard(picked);
      console.log(chalk.green('✔') + ' Copied to clipboard. Paste it into your IDE commit box.');
      break;
  }
}
