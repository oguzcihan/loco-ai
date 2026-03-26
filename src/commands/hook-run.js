import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { generate } from '../core/ollama.js';
import { getConfig } from '../utils/config.js';
import { buildPrompt, parseMessages } from './commit.js';

const MAX_DIFF_CHARS = 4000;

export async function hookRunCommand(filepath, source) {
  // Everything in a try — never block git on failure
  try {
    // Skip when git already has a message (-m, merge, squash, amend, etc.)
    if (source && source !== 'template') {
      process.exit(0);
    }

    // Safety net: if the file already has a meaningful (non-comment) message, skip
    const existing = fs.readFileSync(filepath, 'utf-8');
    const meaningfulLines = existing
      .split('\n')
      .filter(line => line.trim() && !line.startsWith('#'));
    if (meaningfulLines.length > 0 && meaningfulLines[0].trim().length > 0) {
      process.exit(0);
    }

    const config = getConfig();
    if (!config.setupComplete) process.exit(0);

    // Get staged diff
    const diff = execSync('git diff --staged', { encoding: 'utf-8' }).trim();
    if (!diff) process.exit(0);

    const truncated = diff.length > MAX_DIFF_CHARS
      ? diff.slice(0, MAX_DIFF_CHARS) + '\n\n[... diff truncated]'
      : diff;

    const prompt = buildPrompt(truncated);
    const raw = await generate(prompt, config.defaultModel);
    const messages = parseMessages(raw);

    if (messages.length === 0) process.exit(0);
    const message = messages[0];

    // Write the generated message to the file git gave us
    // This pre-fills the commit editor so the user can review/edit
    fs.writeFileSync(filepath, message + '\n');
  } catch {
    // Silent exit — never block git
    process.exit(0);
  }
}
