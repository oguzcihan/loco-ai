import { describe, it, expect } from 'vitest';
import { buildPrompt } from '../../src/core/prompt-builder.js';

const DIFF = 'diff --git a/file.js b/file.js\n+hello world';

describe('buildPrompt', () => {
  it('includes the diff text', () => {
    const convention = { type: 'conventional', confidence: 0.8, samples: [], ticketPattern: null };
    const prompt = buildPrompt(DIFF, convention);
    expect(prompt).toContain(DIFF);
  });

  it('includes conventional type list for conventional convention', () => {
    const convention = { type: 'conventional', confidence: 0.8, samples: [], ticketPattern: null };
    const prompt = buildPrompt(DIFF, convention);
    expect(prompt).toContain('feat:');
    expect(prompt).toContain('fix:');
    expect(prompt).toContain('refactor:');
    expect(prompt).toContain('chore:');
  });

  it('includes ticket pattern for ticket-prefixed convention', () => {
    const convention = { type: 'ticket-prefixed', confidence: 0.7, samples: [], ticketPattern: 'JIRA-' };
    const prompt = buildPrompt(DIFF, convention);
    expect(prompt).toContain('JIRA-');
    expect(prompt).toContain('ticket');
  });

  it('includes imperative verb instructions for imperative convention', () => {
    const convention = { type: 'imperative', confidence: 0.7, samples: [], ticketPattern: null };
    const prompt = buildPrompt(DIFF, convention);
    expect(prompt).toContain('imperative verb');
    expect(prompt).toContain('Add');
    expect(prompt).toContain('Fix');
  });

  it('falls back to conventional for unknown convention', () => {
    const convention = { type: 'unknown', confidence: 0, samples: [], ticketPattern: null };
    const prompt = buildPrompt(DIFF, convention);
    expect(prompt).toContain('feat:');
    expect(prompt).toContain('fix:');
  });

  it('allows longer messages in message mode', () => {
    const convention = { type: 'conventional', confidence: 0.8, samples: [], ticketPattern: null };
    const prompt = buildPrompt(DIFF, convention, 'message');
    expect(prompt).toContain('100 characters');
  });

  it('does NOT mention extended length in commit mode', () => {
    const convention = { type: 'conventional', confidence: 0.8, samples: [], ticketPattern: null };
    const prompt = buildPrompt(DIFF, convention, 'commit');
    expect(prompt).not.toContain('100 characters');
  });

  it('includes repo samples when available', () => {
    const convention = {
      type: 'conventional',
      confidence: 0.8,
      samples: ['feat: add auth', 'fix: resolve crash', 'chore: bump version'],
      ticketPattern: null,
    };
    const prompt = buildPrompt(DIFF, convention);
    expect(prompt).toContain('Examples from this repository');
    expect(prompt).toContain('feat: add auth');
  });

  it('does not include repo examples section when no samples', () => {
    const convention = { type: 'conventional', confidence: 0.8, samples: [], ticketPattern: null };
    const prompt = buildPrompt(DIFF, convention);
    expect(prompt).not.toContain('Examples from this repository');
  });

  it('includes anti-hallucination instruction', () => {
    const convention = { type: 'conventional', confidence: 0.8, samples: [], ticketPattern: null };
    const prompt = buildPrompt(DIFF, convention);
    expect(prompt).toContain('No explanations');
    expect(prompt).toContain('no code fences');
    expect(prompt).toContain('no think tags');
    expect(prompt).toContain('Do NOT end with a colon');
    expect(prompt).toContain('no backticks');
  });

  it('always asks for exactly 3 messages', () => {
    const convention = { type: 'conventional', confidence: 0.8, samples: [], ticketPattern: null };
    const prompt = buildPrompt(DIFF, convention);
    expect(prompt).toContain('exactly 3');
    expect(prompt).toContain('1. ... 2. ... 3. ...');
  });

  it('instructs model to describe overall change, not individual files', () => {
    const convention = { type: 'conventional', confidence: 0.8, samples: [], ticketPattern: null };
    const prompt = buildPrompt(DIFF, convention);
    expect(prompt).toContain('OVERALL purpose');
    expect(prompt).toContain('WHOLE change');
  });

  it('enforces 72 character max', () => {
    const convention = { type: 'conventional', confidence: 0.8, samples: [], ticketPattern: null };
    const prompt = buildPrompt(DIFF, convention);
    expect(prompt).toContain('72 char');
  });

  it('includes type guidance for conventional commits', () => {
    const convention = { type: 'conventional', confidence: 0.8, samples: [], ticketPattern: null };
    const prompt = buildPrompt(DIFF, convention);
    expect(prompt).toContain('Do NOT label new code as "fix:"');
  });
});
