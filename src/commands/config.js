import chalk from 'chalk';
import ora from 'ora';
import { select } from '@inquirer/prompts';
import { listModels } from '../core/ollama.js';
import { getConfig, saveConfig } from '../utils/config.js';

export async function configCommand(options) {
  const config = getConfig();

  // Show current config
  console.log(chalk.bold('\n  Current config\n'));
  console.log(`  defaultModel:   ${chalk.cyan(config.defaultModel)}`);
  console.log(`  setupComplete:  ${config.setupComplete ? chalk.green('true') : chalk.yellow('false')}`);
  console.log('');

  // If --model flag provided, use it directly
  if (options.model) {
    saveConfig({ defaultModel: options.model });
    console.log(chalk.green('✔') + ` Default model changed to ${chalk.cyan(options.model)}`);
    return;
  }

  // Interactive: fetch models and prompt
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

  const choices = models.map((name) => ({
    name: name === config.defaultModel ? `${name} ${chalk.dim('(current)')}` : name,
    value: name,
  }));

  const selected = await select({
    message: 'Select default model:',
    choices,
    default: config.defaultModel,
  });

  if (selected === config.defaultModel) {
    console.log(chalk.dim('No change — already using ' + selected));
    return;
  }

  saveConfig({ defaultModel: selected });
  console.log(chalk.green('✔') + ` Default model changed to ${chalk.cyan(selected)}`);
}
