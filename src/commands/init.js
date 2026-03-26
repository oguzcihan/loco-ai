import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { confirm } from '@inquirer/prompts';

const HOOK_SCRIPT = `#!/bin/sh
loco hook-run "$1"
`;

export async function initCommand() {
  // Step 1: Check if we're in a git repo
  if (!fs.existsSync('.git')) {
    console.error(chalk.red('✖') + ' Not a git repository. Run this inside a project.');
    process.exit(1);
  }

  const hooksDir = path.join('.git', 'hooks');
  const hookPath = path.join(hooksDir, 'prepare-commit-msg');

  // Step 2: Check if hook already exists
  if (fs.existsSync(hookPath)) {
    const existing = fs.readFileSync(hookPath, 'utf-8');

    if (existing.includes('loco hook-run')) {
      console.log(chalk.yellow('⚠') + ' loco hook is already installed.');
      return;
    }

    console.log(chalk.yellow('⚠') + ' A prepare-commit-msg hook already exists.');
    const overwrite = await confirm({ message: 'Overwrite it?', default: false });
    if (!overwrite) {
      console.log(chalk.dim('Cancelled.'));
      return;
    }
  }

  // Step 3: Write the hook
  fs.mkdirSync(hooksDir, { recursive: true });
  fs.writeFileSync(hookPath, HOOK_SCRIPT);

  // Step 4: Make executable
  fs.chmodSync(hookPath, '755');

  // Step 5: Success
  console.log(chalk.green('✔') + ' Git hook installed. Your next ' + chalk.cyan('`git commit`') + ' will use loco.');
}
