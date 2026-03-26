import { execSync, spawn } from 'node:child_process';
import ora from 'ora';
import chalk from 'chalk';
import { checkOllamaRunning } from '../core/ollama.js';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  console.log('After installing, run ' + chalk.cyan('loco setup') + ' to complete the setup.');
}

export async function ensureOllama() {
  // First check if the binary exists at all
  if (!ollamaInstalled()) {
    printInstallGuide();
    process.exit(1);
  }

  // Binary exists, check if service is running
  const running = await checkOllamaRunning();
  if (running) return;

  // Try to start it automatically
  const spin = ora('Ollama is not running — starting it...').start();

  spawn('ollama', ['serve'], {
    stdio: 'ignore',
    detached: true,
  }).unref();

  for (let i = 0; i < 20; i++) {
    await sleep(500);
    if (await checkOllamaRunning()) {
      spin.succeed('Ollama started');
      return;
    }
  }

  spin.fail('Could not start Ollama automatically.');
  console.error(chalk.dim('  Run ' + chalk.cyan('ollama serve') + ' manually and try again.'));
  process.exit(1);
}
