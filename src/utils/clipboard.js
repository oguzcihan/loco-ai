import { execSync } from 'node:child_process';
import chalk from 'chalk';

export function copyToClipboard(text) {
  try {
    const cmd = process.platform === 'darwin' ? 'pbcopy'
      : process.platform === 'win32' ? 'clip'
      : 'xclip -selection clipboard';
    execSync(cmd, { input: text, stdio: ['pipe', 'ignore', 'ignore'] });
  } catch {
    console.log(chalk.yellow('⚠') + ' Could not copy to clipboard. Here is the message:');
    console.log(text);
  }
}
