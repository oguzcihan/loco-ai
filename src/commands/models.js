import chalk from 'chalk';
import ora from 'ora';
import { listModels } from '../core/ollama.js';
import { getConfig } from '../utils/config.js';

export async function modelsCommand() {
  const spin = ora('Fetching models from Ollama...').start();

  let models;
  try {
    models = await listModels();
    spin.stop();
  } catch (err) {
    spin.fail('Could not fetch models');
    console.error(chalk.red('✖'), err.message);
    process.exit(1);
  }

  if (models.length === 0) {
    console.log(chalk.yellow('⚠') + ' No models installed. Pull one with ' + chalk.cyan('ollama pull <model>'));
    return;
  }

  const { defaultModel } = getConfig();

  console.log(chalk.bold('\n  Available models\n'));

  for (const name of models) {
    const isActive = name === defaultModel;
    if (isActive) {
      console.log(`  ${chalk.green('✓')} ${chalk.green(name)} ${chalk.dim('(active)')}`);
    } else {
      console.log(`    ${chalk.white(name)}`);
    }
  }

  console.log('');
}
