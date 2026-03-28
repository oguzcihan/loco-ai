import { execSync, spawn } from 'node:child_process';
import ora from 'ora';
import chalk from 'chalk';
import { confirm } from '@inquirer/prompts';
import { checkOllamaRunning, listModels, pullModel } from '../core/ollama.js';
import { getConfig, saveConfig } from '../utils/config.js';

const OS_NAMES = {
  darwin: 'macOS',
  win32: 'Windows',
  linux: 'Linux',
};

export async function setupCommand() {
  const config = getConfig();
  const model = config.defaultModel;

  // Step 1: Check ollama binary
  if (!ollamaInstalled()) {
    const installed = await guidedOllamaInstall();
    if (!installed) {
      console.error(chalk.red('\u2716 Ollama is required. Setup cannot continue.'));
      process.exit(1);
    }
  }
  console.log(chalk.green('\u2714') + ' Ollama is installed');

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
    console.log(chalk.green('\u2714') + ' Ollama service is running');
  }

  // Step 3: Check if default model is already pulled
  const models = await listModels();
  const alreadyPulled = models.includes(model);

  if (alreadyPulled) {
    console.log(chalk.green('\u2714') + ` Model ${chalk.cyan(model)} is already available`);
  } else {
    console.log(chalk.blue('\u2139') + ` Pulling ${chalk.cyan(model)}...`);

    try {
      await pullModel(model);
      console.log(chalk.green('\u2714') + ` Model ${chalk.cyan(model)} is ready`);
    } catch (err) {
      console.error(chalk.red('\u2716') + ` Failed to pull ${model}: ${err.message}`);
      process.exit(1);
    }
  }

  // Step 4: Save config
  saveConfig({ setupComplete: true });

  // Step 5: Done
  console.log('');
  console.log(chalk.green('\u2714') + ' loco is ready. Run ' + chalk.cyan('`loco commit`') + ' in any git repo.');
}

async function guidedOllamaInstall() {
  const osName = OS_NAMES[process.platform] || process.platform;

  console.log('');
  console.log(chalk.red('\u2716') + ' Ollama is not installed.');
  console.log('');
  console.log(`  Detected OS: ${chalk.bold(osName)}`);
  console.log(`  Ollama is required to run local AI models.`);
  console.log('');

  const shouldInstall = await confirm({
    message: 'Install Ollama now?',
    default: true,
  });

  if (!shouldInstall) {
    console.log('');
    console.log(chalk.bold('To install manually:'));
    printManualInstructions();
    return false;
  }

  console.log('');

  try {
    switch (process.platform) {
      case 'darwin':
        return await installMacOS();
      case 'linux':
        return await installLinux();
      case 'win32':
        return await installWindows();
      default:
        console.log(chalk.yellow('\u26a0') + ` Automatic install is not supported on ${osName}.`);
        console.log('');
        printManualInstructions();
        return false;
    }
  } catch {
    console.log('');
    console.log(chalk.yellow('\u26a0') + ' Automatic installation failed.');
    console.log('');
    printManualInstructions();
    return false;
  }
}

async function installMacOS() {
  // Check if brew is available
  let hasBrew = false;
  try {
    execSync('brew --version', { stdio: 'ignore' });
    hasBrew = true;
  } catch { /* brew not installed */ }

  if (hasBrew) {
    console.log(chalk.dim('Running: brew install ollama'));
    try {
      execSync('brew install ollama', { stdio: 'inherit' });
      if (ollamaInstalled()) return true;
    } catch { /* fall through */ }
  }

  console.log('');
  console.log(chalk.yellow('\u26a0') + (hasBrew
    ? ' brew install failed.'
    : ' Homebrew is not installed.'));
  console.log(`  Download Ollama from: ${chalk.underline('https://ollama.com/download')}`);
  console.log('');

  const retry = await confirm({ message: 'Have you installed Ollama?', default: false });
  return retry && ollamaInstalled();
}

async function installLinux() {
  console.log(chalk.dim('Running: curl -fsSL https://ollama.com/install.sh | sh'));
  execSync('curl -fsSL https://ollama.com/install.sh | sh', { stdio: 'inherit' });

  if (ollamaInstalled()) return true;

  console.log(chalk.yellow('\u26a0') + ' Installation script completed but ollama was not found.');
  console.log(`  Try downloading from: ${chalk.underline('https://ollama.com/download')}`);
  return false;
}

async function installWindows() {
  console.log(chalk.dim('Running: winget install Ollama.Ollama'));
  try {
    execSync('winget install Ollama.Ollama', { stdio: 'inherit' });
    if (ollamaInstalled()) return true;
  } catch { /* fall through */ }

  console.log('');
  console.log(chalk.yellow('\u26a0') + ' winget install failed or winget is not available.');
  console.log(`  Download Ollama from: ${chalk.underline('https://ollama.com/download')}`);
  console.log('');

  const retry = await confirm({ message: 'Have you installed Ollama?', default: false });
  return retry && ollamaInstalled();
}

function printManualInstructions() {
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
  console.log('After installing, run ' + chalk.cyan('loco setup') + ' again.');
}

function ollamaInstalled() {
  try {
    execSync('ollama --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
