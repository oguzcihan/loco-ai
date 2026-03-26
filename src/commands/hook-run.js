import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { generate } from '../core/ollama.js';
import { getConfig } from '../utils/config.js';
import { buildPrompt, cleanMessage } from './commit.js';

const MAX_DIFF_CHARS = 4000;

export async function hookRunCommand(filepath) {
  // Everything in a try — never block git on failure
  try {
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
    const message = cleanMessage(raw);

    if (!message) process.exit(0);

    // Write the generated message to the file git gave us
    // This pre-fills the commit editor so the user can review/edit
    fs.writeFileSync(filepath, message + '\n');
  } catch {
    // Silent exit — never block git
    process.exit(0);
  }
}
