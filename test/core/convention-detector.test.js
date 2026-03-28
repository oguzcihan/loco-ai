import { describe, it, expect } from 'vitest';
import { detectConvention } from '../../src/core/convention-detector.js';

describe('detectConvention', () => {
  it('detects conventional commits', () => {
    const commits = [
      'feat: add user login',
      'fix: resolve null pointer',
      'chore: update dependencies',
      'refactor(auth): simplify token flow',
      'docs: update readme',
      'feat: implement search',
      'test: add unit tests for auth',
      'fix(api): handle timeout errors',
    ];
    const result = detectConvention(commits);
    expect(result.type).toBe('conventional');
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.samples.length).toBeGreaterThan(0);
  });

  it('detects ticket-prefixed commits', () => {
    const commits = [
      'PROJ-123 add user login',
      'PROJ-456 fix null pointer',
      'PROJ-789 update dependencies',
      'PROJ-101 simplify token flow',
      'PROJ-102 update readme',
      'PROJ-103 implement search',
    ];
    const result = detectConvention(commits);
    expect(result.type).toBe('ticket-prefixed');
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.ticketPattern).toBe('PROJ-');
  });

  it('detects imperative style commits', () => {
    const commits = [
      'Add user login functionality',
      'Fix null pointer exception',
      'Update dependencies to latest',
      'Remove deprecated API calls',
      'Refactor authentication module',
      'Improve error handling in API',
    ];
    const result = detectConvention(commits);
    expect(result.type).toBe('imperative');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('returns unknown for mixed/noisy commits', () => {
    const commits = [
      'feat: add login',
      'PROJ-123 fix something',
      'Update the thing',
      'wip',
      'stuff',
      'asdf',
      'more changes',
      'testing 123',
    ];
    const result = detectConvention(commits);
    expect(result.type).toBe('unknown');
  });

  it('returns unknown for empty array', () => {
    const result = detectConvention([]);
    expect(result.type).toBe('unknown');
    expect(result.confidence).toBe(0);
    expect(result.samples).toEqual([]);
  });

  it('returns unknown for fewer than 5 commits', () => {
    const commits = [
      'feat: add login',
      'fix: resolve crash',
      'chore: update deps',
    ];
    const result = detectConvention(commits);
    expect(result.type).toBe('unknown');
  });

  it('returns unknown for null input', () => {
    const result = detectConvention(null);
    expect(result.type).toBe('unknown');
  });

  it('detects mixed ticket prefixes and picks dominant one', () => {
    const commits = [
      'FE-10 add button',
      'FE-11 fix style',
      'FE-12 update layout',
      'BE-1 add endpoint',
      'FE-13 improve nav',
      'FE-14 refactor sidebar',
    ];
    const result = detectConvention(commits);
    expect(result.type).toBe('ticket-prefixed');
    expect(result.ticketPattern).toBe('FE-');
  });

  it('does not confuse conventional commits as imperative', () => {
    const commits = [
      'fix: resolve login issue',
      'feat: add dashboard',
      'refactor: clean up utils',
      'fix: handle edge case',
      'chore: update eslint config',
      'feat: implement notifications',
    ];
    const result = detectConvention(commits);
    expect(result.type).toBe('conventional');
  });

  it('includes representative samples', () => {
    const commits = Array.from({ length: 20 }, (_, i) => `feat: feature ${i}`);
    const result = detectConvention(commits);
    expect(result.samples.length).toBeLessThanOrEqual(5);
    expect(result.samples.length).toBeGreaterThan(0);
    result.samples.forEach(s => expect(s).toMatch(/^feat: feature \d+$/));
  });
});
