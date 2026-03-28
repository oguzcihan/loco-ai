import chalk from 'chalk';
import { getConfig } from './config.js';

export function requireSetup() {
  const config = getConfig();
  if (!config.setupComplete) {
    console.error(chalk.red('\u2716') + ' Setup required. Please run: ' + chalk.cyan('loco setup'));
    process.exit(1);
  }
  return config;
}
