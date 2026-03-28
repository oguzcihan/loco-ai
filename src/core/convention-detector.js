const CONVENTIONAL_RE = /^(feat|fix|refactor|docs|style|test|chore|build|ci|perf|revert)(\(.+?\))?!?:\s/;
const TICKET_RE = /^[A-Z]{2,}-\d+[\s:]/;
const IMPERATIVE_VERBS = [
  'add', 'fix', 'update', 'remove', 'refactor', 'change', 'implement',
  'create', 'delete', 'move', 'rename', 'improve', 'clean', 'merge',
  'bump', 'release', 'revert', 'set', 'use', 'make', 'handle',
  'support', 'allow', 'enable', 'disable', 'replace', 'convert',
  'extract', 'simplify', 'optimize', 'upgrade', 'downgrade',
];
const IMPERATIVE_RE = new RegExp(`^(${IMPERATIVE_VERBS.join('|')})\\b`, 'i');

const MIN_COMMITS = 5;

export function detectConvention(commits) {
  const unknown = { type: 'unknown', confidence: 0, samples: [], ticketPattern: null };

  if (!commits || commits.length < MIN_COMMITS) {
    return unknown;
  }

  const total = commits.length;

  // Count matches for each convention
  const conventionalMatches = commits.filter(c => CONVENTIONAL_RE.test(c));
  const ticketMatches = commits.filter(c => TICKET_RE.test(c));
  const imperativeMatches = commits.filter(c => IMPERATIVE_RE.test(c));

  const conventionalRatio = conventionalMatches.length / total;
  const ticketRatio = ticketMatches.length / total;
  const imperativeRatio = imperativeMatches.length / total;

  // Conventional commits take priority (they also match imperative sometimes)
  if (conventionalRatio > 0.5) {
    return {
      type: 'conventional',
      confidence: conventionalRatio,
      samples: pickSamples(conventionalMatches),
      ticketPattern: null,
    };
  }

  if (ticketRatio > 0.5) {
    const pattern = detectTicketPattern(ticketMatches);
    return {
      type: 'ticket-prefixed',
      confidence: ticketRatio,
      samples: pickSamples(ticketMatches),
      ticketPattern: pattern,
    };
  }

  // Only match imperative if it's not already conventional
  const pureImperative = imperativeMatches.filter(c => !CONVENTIONAL_RE.test(c));
  const pureImperativeRatio = pureImperative.length / total;

  if (pureImperativeRatio > 0.5) {
    return {
      type: 'imperative',
      confidence: pureImperativeRatio,
      samples: pickSamples(pureImperative),
      ticketPattern: null,
    };
  }

  return unknown;
}

function pickSamples(matches) {
  // Pick up to 5 unique, representative examples spread across the list
  const step = Math.max(1, Math.floor(matches.length / 5));
  const samples = [];
  for (let i = 0; i < matches.length && samples.length < 5; i += step) {
    samples.push(matches[i]);
  }
  return samples;
}

function detectTicketPattern(ticketMatches) {
  // Find the most common ticket prefix (e.g., "PROJ-")
  const prefixCounts = {};
  for (const msg of ticketMatches) {
    const match = msg.match(/^([A-Z]{2,}-)/);
    if (match) {
      prefixCounts[match[1]] = (prefixCounts[match[1]] || 0) + 1;
    }
  }

  let bestPrefix = null;
  let bestCount = 0;
  for (const [prefix, count] of Object.entries(prefixCounts)) {
    if (count > bestCount) {
      bestPrefix = prefix;
      bestCount = count;
    }
  }

  return bestPrefix;
}
