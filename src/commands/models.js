import chalk from 'chalk';
import ora from 'ora';
import { select, input } from '@inquirer/prompts';
import { listModels, pullModel } from '../core/ollama.js';
import { getConfig, saveConfig } from '../utils/config.js';

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

  const { defaultModel } = getConfig();

  if (models.length === 0) {
    console.log(chalk.yellow('⚠') + ' No models installed.');

    if (process.stdout.isTTY) {
      const modelName = await input({
        message: 'Enter a model name to pull (e.g. qwen2.5-coder:1.5b):',
      });
      if (modelName.trim()) {
        await doPull(modelName.trim());
        saveConfig({ defaultModel: modelName.trim() });
        console.log(chalk.green('✔') + ' Set as default model.');
      }
    } else {
      console.log('Pull one with ' + chalk.cyan('loco pull <model>'));
    }
    return;
  }

  // Display list
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

  // Interactive menu only in TTY
  if (!process.stdout.isTTY) return;

  const action = await select({
    message: 'What would you like to do?',
    choices: [
      { name: 'Done',             value: 'done' },
      { name: 'Set active model', value: 'set' },
      { name: 'Pull a new model', value: 'pull' },
    ],
  });

  switch (action) {
    case 'set': {
      const choices = models.map((name) => ({
        name: name === defaultModel ? `${name} ${chalk.dim('(current)')}` : name,
        value: name,
      }));
      const selected = await select({
        message: 'Select default model:',
        choices,
        default: defaultModel,
      });
      if (selected !== defaultModel) {
        saveConfig({ defaultModel: selected });
        console.log(chalk.green('✔') + ` Default model changed to ${chalk.cyan(selected)}`);
      } else {
        console.log(chalk.dim('No change.'));
      }
      break;
    }
    case 'pull': {
      const modelName = await input({
        message: 'Model name to pull (e.g. llama3.2:1b):',
      });
      if (modelName.trim()) {
        await doPull(modelName.trim());
      }
      break;
    }
    case 'done':
    default:
      break;
  }
}

async function doPull(modelName) {
  console.log(chalk.blue('ℹ') + ` Pulling ${chalk.cyan(modelName)}...`);
  try {
    await pullModel(modelName);
    console.log(chalk.green('✔') + ` Model ${chalk.cyan(modelName)} is ready.`);
  } catch (err) {
    console.error(chalk.red('✖') + ` Failed to pull ${modelName}: ${err.message}`);
  }
}
