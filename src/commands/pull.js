import chalk from 'chalk';
import { pullModel, listModels } from '../core/ollama.js';
import { ensureOllama } from '../utils/ensure-ollama.js';

export async function pullCommand(modelName) {
  await ensureOllama();

  const models = await listModels();
  if (models.includes(modelName)) {
    console.log(chalk.green('✔') + ` Model ${chalk.cyan(modelName)} is already available.`);
    return;
  }

  console.log(chalk.blue('ℹ') + ` Pulling ${chalk.cyan(modelName)}...`);

  try {
    await pullModel(modelName);
    console.log(chalk.green('✔') + ` Model ${chalk.cyan(modelName)} is ready.`);
  } catch (err) {
    console.error(chalk.red('✖') + ` Failed to pull ${modelName}: ${err.message}`);
    process.exit(1);
  }
}
