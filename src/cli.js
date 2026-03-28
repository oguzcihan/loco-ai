import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Command } from 'commander';
import { setupCommand } from './commands/setup.js';
import { commitCommand } from './commands/commit.js';
import { initCommand } from './commands/init.js';
import { configCommand } from './commands/config.js';
import { modelsCommand } from './commands/models.js';
import { doctorCommand } from './commands/doctor.js';
import { hookRunCommand } from './commands/hook-run.js';
import { messageCommand } from './commands/message.js';
import { pullCommand } from './commands/pull.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

// Gracefully handle Ctrl+C in any inquirer prompt (select, input, confirm)
process.on('uncaughtException', (err) => {
  if (err.name === 'ExitPromptError') {
    console.log('');
    process.exit(0);
  }
  throw err;
});

export function run() {
  const program = new Command();

  program
    .name('loco')
    .description('Local AI commit messages. No API keys. No cloud.\n\nPowered by Ollama — runs entirely on your machine.')
    .version(pkg.version, '-v, --version');

  program
    .command('setup')
    .description('Check Ollama installation and pull the default model')
    .addHelpText('after', `
Examples:
  $ loco setup              Install Ollama (if needed) and pull the default model
`)
    .action(setupCommand);

  program
    .command('commit')
    .description('Generate an AI commit message from staged changes')
    .option('--hook <file>', 'Run in git hook mode (non-interactive)')
    .addHelpText('after', `
Examples:
  $ git add .
  $ loco commit             Generate a message, review, and commit
`)
    .action(commitCommand);

  program
    .command('init')
    .description('Install a git hook so git commit triggers loco automatically')
    .addHelpText('after', `
Examples:
  $ loco init               Install the prepare-commit-msg hook
  $ git commit              Loco generates the message, you edit in your editor
`)
    .action(initCommand);

  program
    .command('config')
    .description('View or change the active Ollama model')
    .option('--model <name>', 'Set the default model directly')
    .addHelpText('after', `
Examples:
  $ loco config             Interactive model selection
  $ loco config --model llama3.2:1b
`)
    .action(configCommand);

  program
    .command('models')
    .description('List, select, and pull Ollama models')
    .addHelpText('after', `
Examples:
  $ loco models             List models with interactive menu
`)
    .action(modelsCommand);

  program
    .command('pull')
    .argument('<model>', 'Model name to pull (e.g. llama3.2:1b)')
    .description('Pull a model from the Ollama library')
    .addHelpText('after', `
Examples:
  $ loco pull llama3.2:1b   Download a specific model
  $ loco pull mistral:latest
`)
    .action(pullCommand);

  program
    .command('message')
    .alias('msg')
    .description('Generate a commit message without committing')
    .addHelpText('after', `
Examples:
  $ git add .
  $ loco message            Generate and display a commit message
  $ loco msg                Same thing, shorter alias
`)
    .action(messageCommand);

  program
    .command('doctor')
    .description('Check if everything is set up correctly')
    .addHelpText('after', `
Examples:
  $ loco doctor             Run all health checks
`)
    .action(doctorCommand);

  program
    .command('hook-run', { hidden: true })
    .argument('<filepath>', 'Commit message file path (passed by git)')
    .argument('[source]', 'Commit message source (message, merge, squash, commit, template)')
    .action(hookRunCommand);

  program.parse();
}
