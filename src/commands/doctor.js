import fs from 'node:fs';
import { execSync } from 'node:child_process';
import chalk from 'chalk';
import { checkOllamaRunning, listModels } from '../core/ollama.js';
import { getConfig } from '../utils/config.js';

const PASS = chalk.green('✓');
const FAIL = chalk.red('✗');

export async function doctorCommand() {
  console.log(chalk.bold('\n  loco doctor\n'));

  let allGood = true;

  // 1. Ollama installed?
  const installed = ollamaInstalled();
  if (installed) {
    console.log(`  ${PASS} Ollama is installed`);
  } else {
    console.log(`  ${FAIL} Ollama is not installed`);
    console.log(chalk.dim('    Fix: https://ollama.com/download'));
    allGood = false;
  }

  // 2. Ollama running?
  const running = installed ? await checkOllamaRunning() : false;
  if (running) {
    console.log(`  ${PASS} Ollama service is running`);
  } else if (installed) {
    console.log(`  ${FAIL} Ollama service is not running`);
    console.log(chalk.dim('    Fix: run "ollama serve" or open the Ollama app'));
    allGood = false;
  } else {
    console.log(`  ${FAIL} Ollama service is not running ${chalk.dim('(install Ollama first)')}`);
    allGood = false;
  }

  // 3. Default model available?
  const config = getConfig();
  const model = config.defaultModel;
  if (running) {
    try {
      const models = await listModels();
      if (models.includes(model)) {
        console.log(`  ${PASS} Default model ${chalk.cyan(model)} is available`);
      } else {
        console.log(`  ${FAIL} Default model ${chalk.cyan(model)} is not pulled`);
        console.log(chalk.dim(`    Fix: run "loco setup" or "ollama pull ${model}"`));
        allGood = false;
      }
    } catch {
      console.log(`  ${FAIL} Could not check models`);
      allGood = false;
    }
  } else {
    console.log(`  ${FAIL} Cannot check model ${chalk.cyan(model)} ${chalk.dim('(Ollama not running)')}`);
    allGood = false;
  }

  // 4. Current directory is a git repo?
  if (fs.existsSync('.git')) {
    console.log(`  ${PASS} Current directory is a git repository`);
  } else {
    console.log(`  ${FAIL} Current directory is not a git repository`);
    console.log(chalk.dim('    Fix: run "git init" or cd into a git project'));
    allGood = false;
  }

  console.log('');
  if (allGood) {
    console.log(chalk.green('  All checks passed. loco is ready to use.'));
  } else {
    console.log(chalk.yellow('  Some checks failed. Fix the issues above and run "loco doctor" again.'));
  }
  console.log('');
}

function ollamaInstalled() {
  try {
    execSync('ollama --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
