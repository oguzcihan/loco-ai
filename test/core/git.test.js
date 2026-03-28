import { describe, it, expect } from 'vitest';
import { getDiff, getStagedDiff, getWorkingTreeDiff, getRecentCommits, ensureGitRepo, parseDiffFiles, isNoiseFile, compressDiff } from '../../src/core/git.js';

describe('ensureGitRepo', () => {
  it('does not throw inside a git repo', () => {
    const mockExec = () => 'true';
    expect(() => ensureGitRepo(mockExec)).not.toThrow();
  });

  it('throws when not inside a git repo', () => {
    const mockExec = () => { throw new Error('not a git repo'); };
    expect(() => ensureGitRepo(mockExec)).toThrow('Not inside a git repository.');
  });
});

describe('getStagedDiff', () => {
  it('returns staged diff output', () => {
    const mockExec = () => '  diff --git a/file.js b/file.js\n+hello  ';
    expect(getStagedDiff(mockExec)).toBe('diff --git a/file.js b/file.js\n+hello');
  });

  it('returns empty string on error', () => {
    const mockExec = () => { throw new Error('fail'); };
    expect(getStagedDiff(mockExec)).toBe('');
  });
});

describe('getWorkingTreeDiff', () => {
  it('returns unstaged diff output', () => {
    const mockExec = () => 'diff --git a/file.js b/file.js\n+world';
    expect(getWorkingTreeDiff(mockExec)).toBe('diff --git a/file.js b/file.js\n+world');
  });

  it('returns empty string on error', () => {
    const mockExec = () => { throw new Error('fail'); };
    expect(getWorkingTreeDiff(mockExec)).toBe('');
  });
});

describe('getDiff', () => {
  it('returns staged diff when available', () => {
    const mockExec = (cmd) => {
      if (cmd === 'git diff --staged') return 'staged changes';
      return '';
    };
    expect(getDiff(mockExec)).toBe('staged changes');
  });

  it('falls back to working tree diff when no staged changes', () => {
    const mockExec = (cmd) => {
      if (cmd === 'git diff --staged') return '';
      if (cmd === 'git diff') return 'unstaged changes';
      return '';
    };
    expect(getDiff(mockExec)).toBe('unstaged changes');
  });

  it('falls back to git diff NOT git diff HEAD', () => {
    const commands = [];
    const mockExec = (cmd) => {
      commands.push(cmd);
      if (cmd === 'git diff --staged') return '';
      if (cmd === 'git diff') return 'unstaged';
      return '';
    };
    getDiff(mockExec);
    expect(commands).toContain('git diff');
    expect(commands).not.toContain('git diff HEAD');
  });

  it('returns empty string when no changes', () => {
    const mockExec = () => '';
    expect(getDiff(mockExec)).toBe('');
  });
});

describe('getRecentCommits', () => {
  it('parses git log output into array', () => {
    const mockExec = () => 'feat: add login\nfix: resolve crash\nchore: update deps';
    const result = getRecentCommits(50, mockExec);
    expect(result).toEqual(['feat: add login', 'fix: resolve crash', 'chore: update deps']);
  });

  it('returns empty array on error', () => {
    const mockExec = () => { throw new Error('no git'); };
    expect(getRecentCommits(50, mockExec)).toEqual([]);
  });

  it('returns empty array for empty output', () => {
    const mockExec = () => '';
    expect(getRecentCommits(50, mockExec)).toEqual([]);
  });

  it('filters empty lines', () => {
    const mockExec = () => 'feat: add login\n\nfix: crash\n';
    const result = getRecentCommits(50, mockExec);
    expect(result).toEqual(['feat: add login', 'fix: crash']);
  });
});

// --- Diff compression tests ---

function makeDiffFile(path, addedLines, removedLines = 0) {
  let content = `diff --git a/${path} b/${path}\nindex abc..def 100644\n--- a/${path}\n+++ b/${path}\n@@ -1,${removedLines} +1,${addedLines} @@\n`;
  for (let i = 0; i < removedLines; i++) content += `-removed line ${i}\n`;
  for (let i = 0; i < addedLines; i++) content += `+added line ${i}\n`;
  return content;
}

function makeMultiFileDiff(files) {
  return files.map(f => makeDiffFile(f.path, f.added || 1, f.removed || 0)).join('\n');
}

describe('parseDiffFiles', () => {
  it('splits a multi-file diff into per-file sections', () => {
    const diff = makeMultiFileDiff([
      { path: 'src/app.js', added: 3 },
      { path: 'src/utils.js', added: 2, removed: 1 },
    ]);
    const files = parseDiffFiles(diff);
    expect(files).toHaveLength(2);
    expect(files[0].path).toBe('src/app.js');
    expect(files[1].path).toBe('src/utils.js');
  });

  it('counts added and removed lines', () => {
    const diff = makeDiffFile('file.js', 5, 3);
    const files = parseDiffFiles(diff);
    expect(files[0].added).toBe(5);
    expect(files[0].removed).toBe(3);
  });

  it('detects binary files', () => {
    const diff = 'diff --git a/logo.png b/logo.png\nBinary files /dev/null and b/logo.png differ';
    const files = parseDiffFiles(diff);
    expect(files[0].isBinary).toBe(true);
  });

  it('returns empty array for empty input', () => {
    expect(parseDiffFiles('')).toEqual([]);
  });

  it('handles single file diff', () => {
    const diff = makeDiffFile('index.js', 1);
    const files = parseDiffFiles(diff);
    expect(files).toHaveLength(1);
    expect(files[0].path).toBe('index.js');
  });
});

describe('isNoiseFile', () => {
  it('identifies lockfiles as noise', () => {
    expect(isNoiseFile('package-lock.json')).toBe(true);
    expect(isNoiseFile('yarn.lock')).toBe(true);
    expect(isNoiseFile('pnpm-lock.yaml')).toBe(true);
    expect(isNoiseFile('Cargo.lock')).toBe(true);
    expect(isNoiseFile('go.sum')).toBe(true);
    expect(isNoiseFile('Gemfile.lock')).toBe(true);
    expect(isNoiseFile('poetry.lock')).toBe(true);
    expect(isNoiseFile('composer.lock')).toBe(true);
    expect(isNoiseFile('Pipfile.lock')).toBe(true);
  });

  it('identifies minified files as noise', () => {
    expect(isNoiseFile('dist/bundle.min.js')).toBe(true);
    expect(isNoiseFile('styles.min.css')).toBe(true);
  });

  it('identifies sourcemaps as noise', () => {
    expect(isNoiseFile('bundle.js.map')).toBe(true);
  });

  it('does not flag normal source files', () => {
    expect(isNoiseFile('src/app.js')).toBe(false);
    expect(isNoiseFile('lib/utils.ts')).toBe(false);
    expect(isNoiseFile('package.json')).toBe(false);
    expect(isNoiseFile('README.md')).toBe(false);
  });

  it('handles nested paths', () => {
    expect(isNoiseFile('frontend/node_modules/../package-lock.json')).toBe(true);
    expect(isNoiseFile('deep/nested/src/app.js')).toBe(false);
  });
});

describe('compressDiff', () => {
  it('returns small diff unchanged', () => {
    const diff = makeDiffFile('app.js', 2);
    const { diff: result, wasCompressed } = compressDiff(diff);
    expect(result).toBe(diff);
    expect(wasCompressed).toBe(false);
  });

  it('filters noise files into summary section', () => {
    const lockContent = 'x'.repeat(10000);
    const diff = makeDiffFile('src/app.js', 2) + '\n'
      + `diff --git a/package-lock.json b/package-lock.json\nindex abc..def 100644\n--- a/package-lock.json\n+++ b/package-lock.json\n@@ -1,1 +1,1 @@\n+${lockContent}`;

    const { diff: result, wasCompressed } = compressDiff(diff, 5000);
    expect(wasCompressed).toBe(true);
    // Should include file overview at the top
    expect(result).toContain('Files changed (2)');
    // Should include the app.js diff content
    expect(result).toContain('src/app.js');
    expect(result).toContain('+added line');
    // Lock file should be summarized, not included in full
    expect(result).not.toContain(lockContent);
    expect(result).toContain('package-lock.json');
    expect(result).toContain('Also changed (not shown)');
  });

  it('summarizes large files that do not fit', () => {
    // Create a diff with one small file and one very large file
    const smallDiff = makeDiffFile('small.js', 2);
    const largeDiff = makeDiffFile('large.js', 500, 200);

    const combined = smallDiff + '\n' + largeDiff;
    const limit = smallDiff.length + 1500; // enough for small + overview, not for large

    const { diff: result, wasCompressed } = compressDiff(combined, limit);
    expect(wasCompressed).toBe(true);
    // Should include file overview
    expect(result).toContain('Files changed (2)');
    // Small file should be fully included
    expect(result).toContain('+added line 0');
    // Large file should be summarized
    expect(result).toContain('large.js');
    expect(result).toContain('Summarized files');
  });

  it('prioritizes small diffs (most informative)', () => {
    const tiny = makeDiffFile('tiny.js', 1);
    const medium = makeDiffFile('medium.js', 100);
    const large = makeDiffFile('large.js', 500);

    const combined = large + '\n' + tiny + '\n' + medium;
    // Set limit so only tiny + medium + overview fit
    const limit = tiny.length + medium.length + 1500;

    const { diff: result } = compressDiff(combined, limit);
    // File overview should be present
    expect(result).toContain('Files changed (3)');
    // Tiny file should definitely be included
    expect(result).toContain('diff --git a/tiny.js');
    // Large file should be summarized
    expect(result).toContain('large.js');
  });

  it('handles binary files as noise', () => {
    const codeDiff = makeDiffFile('app.js', 30);
    // Make binary portion large enough to push combined over limit
    const binaryPad = 'x'.repeat(1000);
    const binaryDiff = `diff --git a/image.png b/image.png\nGIT binary patch\n${binaryPad}`;

    const combined = codeDiff + '\n' + binaryDiff;
    // Limit: code fits + overhead, but combined exceeds it
    const limit = codeDiff.length + 400;
    expect(combined.length).toBeGreaterThan(limit); // ensure compression triggers

    const { diff: result, wasCompressed } = compressDiff(combined, limit);
    expect(wasCompressed).toBe(true);
    // File overview should list both
    expect(result).toContain('Files changed (2)');
    // Code file should be fully included
    expect(result).toContain('diff --git a/app.js');
    // Binary file should be summarized, not included in full
    expect(result).toContain('image.png (binary)');
    expect(result).toContain('Also changed (not shown)');
    expect(result).not.toContain(binaryPad);
  });

  it('handles all noise files gracefully', () => {
    const diff = `diff --git a/package-lock.json b/package-lock.json\nindex abc..def 100644\n--- a/package-lock.json\n+++ b/package-lock.json\n@@ -1,1 +1,1 @@\n+lock content`;

    const { diff: result, wasCompressed } = compressDiff(diff, 100);
    expect(wasCompressed).toBe(true);
    expect(result).toContain('package-lock.json');
  });

  it('includes file overview showing all files when compressed', () => {
    const diff = makeMultiFileDiff([
      { path: 'src/a.js', added: 5 },
      { path: 'src/b.js', added: 10, removed: 3 },
      { path: 'src/c.js', added: 2 },
    ]);
    const { diff: result } = compressDiff(diff, diff.length - 1);
    expect(result).toContain('Files changed (3)');
    expect(result).toContain('src/a.js (+5)');
    expect(result).toContain('src/b.js (+10, -3)');
    expect(result).toContain('src/c.js (+2)');
  });

  it('uses 15000 char default limit', () => {
    // A diff under 15000 chars should not be compressed
    const diff = makeDiffFile('app.js', 100);
    expect(diff.length).toBeLessThan(15000);
    const { wasCompressed } = compressDiff(diff);
    expect(wasCompressed).toBe(false);
  });
});
