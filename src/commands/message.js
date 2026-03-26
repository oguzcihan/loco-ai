import { execSync } from 'node:child_process';
import ora from 'ora';
import chalk from 'chalk';
import { select, confirm } from '@inquirer/prompts';
import { generate } from '../core/ollama.js';
import { getConfig } from '../utils/config.js';
import { setupCommand } from './setup.js';
import { ensureOllama } from '../utils/ensure-ollama.js';
import { getDiff, buildPrompt, cleanMessage, printMessageBox } from './commit.js';

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
    console.error(chalk.red('✖') + ' Model returned an empty message. Try again.');
    process.exit(1);
  }

  printMessageBox(message);

  const action = await select({
    message: 'What would you like to do?',
    choices: [
      { name: 'Approve (copy to clipboard)', value: 'approve' },
      { name: 'Regenerate',                  value: 'regenerate' },
      { name: 'Cancel',                      value: 'cancel' },
    ],
  });

  switch (action) {
    case 'approve':
      copyToClipboard(message);
      console.log(chalk.green('✔') + ' Copied to clipboard. Paste it into your IDE commit box.');
      break;

    case 'regenerate':
      await generateAndPrompt(diff, model);
      break;

    case 'cancel':
      console.log(chalk.dim('Cancelled.'));
      break;
  }
}

function copyToClipboard(text) {
  try {
    const cmd = process.platform === 'darwin' ? 'pbcopy'
      : process.platform === 'win32' ? 'clip'
      : 'xclip -selection clipboard';
    execSync(cmd, { input: text, stdio: ['pipe', 'ignore', 'ignore'] });
  } catch {
    // Fallback: just print it so user can copy manually
    console.log(chalk.yellow('⚠') + ' Could not copy to clipboard. Here is the message:');
    console.log(text);
  }
}
