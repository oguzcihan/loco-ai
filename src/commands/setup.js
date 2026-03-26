import { execSync, spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import ora from 'ora';
import chalk from 'chalk';
import { checkOllamaRunning, listModels, pullModel } from '../core/ollama.js';
import { getConfig, saveConfig } from '../utils/config.js';

export async function setupCommand() {
  const config = getConfig();
  const model = config.defaultModel;

  // Step 1: Check ollama binary
  if (!ollamaInstalled()) {
    printInstallGuide();
    await waitForEnter();

    if (!ollamaInstalled()) {
      console.error(chalk.red('✖ Ollama still not found. Install it and try again.'));
      process.exit(1);
    }
  }
  console.log(chalk.green('✔') + ' Ollama is installed');

  // Step 2: Check if ollama service is running, start if not
  let running = await checkOllamaRunning();
  if (!running) {
    const spin = ora('Starting Ollama service...').start();
    spawn('ollama', ['serve'], {
      stdio: 'ignore',
      detached: true,
    }).unref();

    // Wait up to 10s for it to come up
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      running = await checkOllamaRunning();
      if (running) break;
    }

    if (!running) {
      spin.fail('Could not start Ollama. Run "ollama serve" manually and try again.');
      process.exit(1);
    }
    spin.succeed('Ollama service is running');
  } else {
    console.log(chalk.green('✔') + ' Ollama service is running');
  }

  // Step 3: Check if default model is already pulled
  const models = await listModels();
  const alreadyPulled = models.includes(model);

  if (alreadyPulled) {
    console.log(chalk.green('✔') + ` Model ${chalk.cyan(model)} is already available`);
  } else {
    console.log(chalk.blue('ℹ') + ` Pulling ${chalk.cyan(model)}...`);

    try {
      await pullModel(model);
      console.log(chalk.green('✔') + ` Model ${chalk.cyan(model)} is ready`);
    } catch (err) {
      console.error(chalk.red('✖') + ` Failed to pull ${model}: ${err.message}`);
      process.exit(1);
    }
  }

  // Step 4: Save config
  saveConfig({ setupComplete: true });

  // Step 5: Done
  console.log('');
  console.log(chalk.green('✔') + ' loco is ready. Run ' + chalk.cyan('`loco commit`') + ' in any git repo.');
}

function ollamaInstalled() {
  try {
    execSync('ollama --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function printInstallGuide() {
  console.log('');
  console.log(chalk.red('✖') + ' Ollama is not installed.');
  console.log('');
  console.log(chalk.bold('Install Ollama:'));

  switch (process.platform) {
    case 'darwin':
      console.log(`  ${chalk.cyan('brew install ollama')}`);
      console.log(`  or download from ${chalk.underline('https://ollama.com/download')}`);
      break;
    case 'win32':
      console.log(`  ${chalk.cyan('winget install Ollama.Ollama')}`);
      console.log(`  or download from ${chalk.underline('https://ollama.com/download')}`);
      break;
    default:
      console.log(`  ${chalk.cyan('curl -fsSL https://ollama.com/install.sh | sh')}`);
      break;
  }

  console.log('');
  console.log('Install Ollama, then press ENTER to continue.');
}

function waitForEnter() {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question('', () => {
      rl.close();
      resolve();
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
