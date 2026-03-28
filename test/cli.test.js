import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CLI = join(ROOT, 'bin', 'loco.js');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));

function run(args) {
  try {
    const output = execSync(`node ${CLI} ${args}`, { encoding: 'utf-8', cwd: ROOT });
    return { output: output.trim(), exitCode: 0 };
  } catch (err) {
    return { output: (err.stdout || err.stderr || '').trim(), exitCode: err.status };
  }
}

describe('CLI version', () => {
  it('loco -v prints version', () => {
    const { output, exitCode } = run('-v');
    expect(output).toBe(pkg.version);
    expect(exitCode).toBe(0);
  });

  it('loco --version prints version', () => {
    const { output, exitCode } = run('--version');
    expect(output).toBe(pkg.version);
    expect(exitCode).toBe(0);
  });
});

describe('CLI help', () => {
  it('loco -h prints help text', () => {
    const { output, exitCode } = run('-h');
    expect(output).toContain('loco');
    expect(output).toContain('Usage');
    expect(exitCode).toBe(0);
  });

  it('loco --help prints help text', () => {
    const { output, exitCode } = run('--help');
    expect(output).toContain('loco');
    expect(output).toContain('Usage');
    expect(exitCode).toBe(0);
  });

  it('help lists available commands', () => {
    const { output } = run('-h');
    expect(output).toContain('setup');
    expect(output).toContain('commit');
    expect(output).toContain('message');
    expect(output).toContain('doctor');
  });
});

describe('CLI invalid command', () => {
  it('exits with non-zero for invalid command', () => {
    const { exitCode } = run('nonexistent-command-xyz');
    expect(exitCode).not.toBe(0);
  });
});
