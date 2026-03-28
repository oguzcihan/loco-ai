import { execSync } from 'node:child_process';

const DEFAULT_MAX_CHARS = 15000;

// Files that add noise without semantic value for commit messages
const NOISE_PATTERNS = [
  /^package-lock\.json$/,
  /^yarn\.lock$/,
  /^pnpm-lock\.yaml$/,
  /^Gemfile\.lock$/,
  /^Cargo\.lock$/,
  /^composer\.lock$/,
  /^poetry\.lock$/,
  /^Pipfile\.lock$/,
  /^go\.sum$/,
  /^\.DS_Store$/,
  /^Thumbs\.db$/,
  /\.min\.js$/,
  /\.min\.css$/,
  /\.map$/,
  /\.snap$/,
];

export function ensureGitRepo(exec = execSync) {
  try {
    exec('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
  } catch {
    throw new Error('Not inside a git repository.');
  }
}

export function getStagedDiff(exec = execSync) {
  try {
    return exec('git diff --staged', { encoding: 'utf-8' }).trim();
  } catch {
    return '';
  }
}

export function getWorkingTreeDiff(exec = execSync) {
  try {
    return exec('git diff', { encoding: 'utf-8' }).trim();
  } catch {
    return '';
  }
}

export function getDiff(exec = execSync) {
  const staged = getStagedDiff(exec);
  if (staged) return staged;

  const unstaged = getWorkingTreeDiff(exec);
  if (unstaged) return unstaged;

  return '';
}

export function getRecentCommits(count = 50, exec = execSync) {
  try {
    const output = exec(`git log --format=%s -n ${count}`, { encoding: 'utf-8' }).trim();
    if (!output) return [];
    return output.split('\n').filter(line => line.length > 0);
  } catch {
    return [];
  }
}

/**
 * Split a unified diff into per-file sections.
 * Each section starts with "diff --git".
 */
export function parseDiffFiles(rawDiff) {
  const files = [];
  const parts = rawDiff.split(/^(?=diff --git )/m);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Extract file path from "diff --git a/path b/path"
    const headerMatch = trimmed.match(/^diff --git a\/(.+?) b\/(.+)/);
    if (!headerMatch) continue;

    const filePath = headerMatch[2];
    const isBinary = /^Binary files/m.test(trimmed) || /GIT binary patch/m.test(trimmed);

    // Count added/removed lines
    let added = 0;
    let removed = 0;
    if (!isBinary) {
      for (const line of trimmed.split('\n')) {
        if (line.startsWith('+') && !line.startsWith('+++')) added++;
        if (line.startsWith('-') && !line.startsWith('---')) removed++;
      }
    }

    files.push({
      path: filePath,
      content: trimmed,
      isBinary,
      added,
      removed,
      size: trimmed.length,
    });
  }

  return files;
}

/**
 * Check if a file path matches noise patterns (lockfiles, generated, binary artifacts).
 */
export function isNoiseFile(filePath) {
  const basename = filePath.split('/').pop();
  return NOISE_PATTERNS.some(re => re.test(basename));
}

/**
 * Build a one-line stat summary for a file: "path (+added, -removed)"
 */
function fileSummary(file) {
  if (file.isBinary) return `${file.path} (binary)`;
  const parts = [];
  if (file.added > 0) parts.push(`+${file.added}`);
  if (file.removed > 0) parts.push(`-${file.removed}`);
  return `${file.path} (${parts.join(', ') || 'no changes'})`;
}

/**
 * Intelligently compress a diff to fit within a character budget.
 *
 * Strategy:
 * 1. Parse into per-file diffs
 * 2. Filter out noise files (lockfiles, binaries, generated) — include them as one-line summaries
 * 3. If the remaining diff fits, return it with noise summaries appended
 * 4. Otherwise, sort files smallest-first (small diffs = focused changes = most informative)
 *    and pack as many full diffs as fit, summarizing the rest
 */
export function compressDiff(rawDiff, maxChars = DEFAULT_MAX_CHARS) {
  // Fast path: if it already fits, return as-is
  if (rawDiff.length <= maxChars) {
    return { diff: rawDiff, wasCompressed: false };
  }

  const files = parseDiffFiles(rawDiff);
  if (files.length === 0) {
    return { diff: rawDiff.slice(0, maxChars), wasCompressed: true };
  }

  // Separate noise files from meaningful files
  const noiseFiles = [];
  const meaningfulFiles = [];
  for (const file of files) {
    if (isNoiseFile(file.path) || file.isBinary) {
      noiseFiles.push(file);
    } else {
      meaningfulFiles.push(file);
    }
  }

  // Build file overview — always prepended so the model sees the full scope
  const overviewLines = files.map(f => `  ${fileSummary(f)}`);
  const overview = `Files changed (${files.length}):\n${overviewLines.join('\n')}\n`;

  // Build the noise summary block (always included, very cheap)
  let noiseSummary = '';
  if (noiseFiles.length > 0) {
    const summaries = noiseFiles.map(f => `  ${fileSummary(f)}`).join('\n');
    noiseSummary = `\nAlso changed (not shown):\n${summaries}`;
  }

  const reservedForOverview = overview.length;
  const reservedForNoise = noiseSummary.length;

  // Check if all meaningful diffs fit (with overview prepended)
  const totalMeaningful = meaningfulFiles.reduce((sum, f) => sum + f.size, 0);
  if (totalMeaningful + reservedForOverview + reservedForNoise <= maxChars) {
    const diff = overview + '\n' + meaningfulFiles.map(f => f.content).join('\n') + noiseSummary;
    return { diff, wasCompressed: true };
  }

  // Need to be selective: sort smallest-first to maximize number of files with full diffs
  const sorted = [...meaningfulFiles].sort((a, b) => a.size - b.size);

  const includedDiffs = [];
  const summarizedFiles = [];
  let budget = maxChars - reservedForOverview - reservedForNoise;

  // Reserve space for the summary section header
  const summaryHeaderSize = '\n\nSummarized files (diffs omitted):\n'.length;
  budget -= summaryHeaderSize;

  for (const file of sorted) {
    // Estimate summary line cost
    const summaryLine = `  ${fileSummary(file)}`;

    if (file.size <= budget - summaryLine.length) {
      includedDiffs.push(file.content);
      budget -= file.size + 1; // +1 for newline separator
    } else {
      summarizedFiles.push(summaryLine);
      budget -= summaryLine.length + 1;
    }
  }

  // Assemble the final diff: overview first, then diffs, then summaries
  let result = overview;
  result += '\n' + includedDiffs.join('\n');

  if (summarizedFiles.length > 0) {
    result += '\n\nSummarized files (diffs omitted):\n' + summarizedFiles.join('\n');
  }

  result += noiseSummary;

  return { diff: result, wasCompressed: true };
}
