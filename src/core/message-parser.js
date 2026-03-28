const CONVENTIONAL_RE = /^(feat|fix|refactor|docs|style|test|chore|build|ci|perf|revert)(\(.+?\))?!?:\s/;

const VERB_TO_TYPE = {
  add: 'feat', added: 'feat', adding: 'feat', implement: 'feat', implemented: 'feat',
  create: 'feat', created: 'feat', introduce: 'feat', introduced: 'feat',
  fix: 'fix', fixed: 'fix', fixing: 'fix', resolve: 'fix', resolved: 'fix',
  repair: 'fix', correct: 'fix', corrected: 'fix',
  refactor: 'refactor', refactored: 'refactor', restructure: 'refactor',
  simplify: 'refactor', simplified: 'refactor', clean: 'refactor', cleaned: 'refactor',
  extract: 'refactor', move: 'refactor', rename: 'refactor',
  update: 'feat', updated: 'feat', upgrade: 'chore', bump: 'chore',
  remove: 'refactor', removed: 'refactor', delete: 'refactor', deleted: 'refactor',
  document: 'docs', documented: 'docs',
  test: 'test', tested: 'test',
  format: 'style', formatted: 'style',
};

// Max subject line length — standard Git convention, fits most terminals
const MAX_SUBJECT_LENGTH = 72;

export function cleanMessage(raw) {
  let msg = raw.trim();

  // Strip <think>...</think> blocks
  msg = msg.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

  // Strip markdown code fences
  const fenceMatch = msg.match(/^```[\w]*\n?([\s\S]*?)\n?```$/);
  if (fenceMatch) msg = fenceMatch[1].trim();

  // Strip surrounding quotes
  if ((msg.startsWith('"') && msg.endsWith('"')) || (msg.startsWith("'") && msg.endsWith("'"))) {
    msg = msg.slice(1, -1);
  }

  // Take only the first line if model was chatty
  msg = msg.split('\n')[0].trim();

  // Strip markdown formatting (bold **, __, backticks)
  msg = msg.replace(/\*\*/g, '');
  msg = msg.replace(/__/g, '');
  msg = msg.replace(/`/g, '');

  // Strip leading bullet markers (- or *)
  msg = msg.replace(/^[-*]\s+/, '');

  // Remove trailing period or colon (colon = heading marker from chatty models)
  msg = msg.replace(/[.:]+$/, '');

  return msg;
}

/**
 * Check if a line looks like a valid commit message vs junk output.
 * Rejects headings, bullet points, section markers, etc.
 */
function isValidMessage(msg) {
  if (!msg || msg.length < 5) return false;

  // Reject lines that end with ':' — these are headings like "key changes:"
  if (msg.endsWith(':')) return false;

  // Reject lines that are just a type prefix with nothing useful
  if (/^(feat|fix|refactor|docs|style|test|chore|build|ci|perf|revert)(\(.+?\))?!?:\s*$/i.test(msg)) return false;

  return true;
}

export function parseMessages(raw) {
  let text = raw.trim();

  // Strip <think>...</think> blocks
  text = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

  // Strip markdown code fences
  const fenceMatch = text.match(/^```[\w]*\n?([\s\S]*?)\n?```$/);
  if (fenceMatch) text = fenceMatch[1].trim();

  // Try to extract numbered lines: "1. ...", "2. ...", "3. ..."
  const numbered = text.match(/^\d+\.\s+.+$/gm);
  if (numbered && numbered.length >= 2) {
    const cleaned = numbered
      .map(line => cleanMessage(line.replace(/^\d+\.\s+/, '')))
      .filter(msg => msg.length > 0);

    // Apply strict filter, but fall back to unfiltered if it drops everything
    const strict = cleaned.filter(msg => isValidMessage(msg)).slice(0, 3);
    if (strict.length > 0) return strict;
    if (cleaned.length > 0) return cleaned.slice(0, 3);
  }

  // Fallback: split by newlines, clean each
  const cleaned = text.split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .map(l => cleanMessage(l))
    .filter(msg => msg.length > 0);

  const strict = cleaned.filter(msg => isValidMessage(msg)).slice(0, 3);
  if (strict.length > 0) return strict;
  if (cleaned.length > 0) return cleaned.slice(0, 3);

  // Last resort: treat as single message
  const single = cleanMessage(text);
  return single ? [single] : [];
}

export function normalizeMessage(msg, convention) {
  if (!msg) return msg;

  let result = msg.trim();

  // Remove trailing period
  if (result.endsWith('.')) result = result.slice(0, -1);

  switch (convention?.type) {
    case 'conventional':
    case 'unknown':
    case undefined:
      // Enforce lowercase
      result = result.toLowerCase();

      // If missing a valid type prefix, try to infer one
      if (!CONVENTIONAL_RE.test(result)) {
        result = inferConventionalPrefix(result);
      }
      break;

    case 'ticket-prefixed':
      // Leave casing as-is, ticket prefixes are uppercase
      break;

    case 'imperative':
      // Capitalize first letter
      if (result.length > 0) {
        result = result.charAt(0).toUpperCase() + result.slice(1);
      }
      // Strip any accidental conventional prefix
      if (CONVENTIONAL_RE.test(result.toLowerCase())) {
        result = result.replace(/^(feat|fix|refactor|docs|style|test|chore|build|ci|perf|revert)(\(.+?\))?!?:\s*/i, '');
        if (result.length > 0) {
          result = result.charAt(0).toUpperCase() + result.slice(1);
        }
      }
      break;
  }

  return result;
}

export function formatLongMessage(msg) {
  if (!msg || msg.length <= 100) return msg;

  // Split into subject (max 72 chars at word boundary) + body
  const subject = truncateAtWord(msg, MAX_SUBJECT_LENGTH);
  const body = msg.slice(subject.length).trim();

  if (!body) return subject;
  return `${subject}\n\n${body}`;
}

function inferConventionalPrefix(msg) {
  // Try to detect the first word and map to a type
  const firstWord = msg.split(/[\s(:]/)[0].toLowerCase();
  const type = VERB_TO_TYPE[firstWord];

  if (type) {
    // Remove the verb and reconstruct
    const rest = msg.slice(firstWord.length).trim().replace(/^[:\s]+/, '').trim();
    if (rest) return `${type}: ${rest.toLowerCase()}`;
  }

  // Default: wrap as feat (prefer feat over chore for new code)
  return `feat: ${msg}`;
}

function truncateAtWord(text, maxLen) {
  if (text.length <= maxLen) return text;

  const truncated = text.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > maxLen * 0.6) {
    return truncated.slice(0, lastSpace);
  }

  return truncated;
}
