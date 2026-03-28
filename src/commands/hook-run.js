import fs from 'node:fs';
import { generate } from '../core/ollama.js';
import { getConfig } from '../utils/config.js';
import { getStagedDiff, getRecentCommits, compressDiff } from '../core/git.js';
import { detectConvention } from '../core/convention-detector.js';
import { buildPrompt } from '../core/prompt-builder.js';
import { parseMessages, normalizeMessage } from '../core/message-parser.js';

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
    const diff = getStagedDiff();
    if (!diff) process.exit(0);

    const { diff: truncated } = compressDiff(diff);

    // Detect convention from git history (fail silently)
    let convention = { type: 'unknown', confidence: 0, samples: [], ticketPattern: null };
    try {
      const commits = getRecentCommits(50);
      convention = detectConvention(commits);
    } catch { /* ignore */ }

    const prompt = buildPrompt(truncated, convention, 'commit');
    const raw = await generate(prompt, config.defaultModel);
    const messages = parseMessages(raw);

    if (messages.length === 0) process.exit(0);
    const message = normalizeMessage(messages[0], convention);

    // Write the generated message to the file git gave us
    fs.writeFileSync(filepath, message + '\n');
  } catch {
    // Silent exit — never block git
    process.exit(0);
  }
}
