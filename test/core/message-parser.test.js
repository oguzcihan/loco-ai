import { describe, it, expect } from 'vitest';
import { parseMessages, cleanMessage, normalizeMessage, formatLongMessage } from '../../src/core/message-parser.js';

describe('cleanMessage', () => {
  it('strips think blocks', () => {
    expect(cleanMessage('<think>reasoning here</think>feat: add login')).toBe('feat: add login');
  });

  it('strips markdown code fences', () => {
    expect(cleanMessage('```\nfeat: add login\n```')).toBe('feat: add login');
  });

  it('strips surrounding quotes', () => {
    expect(cleanMessage('"feat: add login"')).toBe('feat: add login');
    expect(cleanMessage("'feat: add login'")).toBe('feat: add login');
  });

  it('takes only first line', () => {
    expect(cleanMessage('feat: add login\nsome extra text')).toBe('feat: add login');
  });

  it('removes trailing period', () => {
    expect(cleanMessage('feat: add login.')).toBe('feat: add login');
  });

  it('removes trailing colon (heading marker)', () => {
    expect(cleanMessage('chore: enhanced diff handling:')).toBe('chore: enhanced diff handling');
  });

  it('strips backticks', () => {
    expect(cleanMessage('refactor: improve `messageCommand` handling')).toBe('refactor: improve messageCommand handling');
  });

  it('trims whitespace', () => {
    expect(cleanMessage('  feat: add login  ')).toBe('feat: add login');
  });

  it('strips leading bullet markers', () => {
    expect(cleanMessage('- add user login flow')).toBe('add user login flow');
    expect(cleanMessage('* add user login flow')).toBe('add user login flow');
  });

  it('strips markdown bold markers (**)', () => {
    expect(cleanMessage('chore: **refactor commit and message commands**')).toBe('chore: refactor commit and message commands');
  });

  it('strips markdown underline bold markers (__)', () => {
    expect(cleanMessage('feat: __add user login__ flow')).toBe('feat: add user login flow');
  });

  it('handles empty input', () => {
    expect(cleanMessage('')).toBe('');
  });
});

describe('parseMessages', () => {
  it('parses numbered output correctly', () => {
    const raw = '1. feat: add user login\n2. fix: resolve null pointer\n3. chore: update deps';
    const result = parseMessages(raw);
    expect(result).toEqual(['feat: add user login', 'fix: resolve null pointer', 'chore: update deps']);
  });

  it('strips think blocks before parsing', () => {
    const raw = '<think>let me think about this</think>\n1. feat: add login\n2. fix: crash\n3. chore: deps';
    const result = parseMessages(raw);
    expect(result).toEqual(['feat: add login', 'fix: crash', 'chore: deps']);
  });

  it('strips markdown fences', () => {
    const raw = '```\n1. feat: add login\n2. fix: crash\n3. chore: deps\n```';
    const result = parseMessages(raw);
    expect(result).toEqual(['feat: add login', 'fix: crash', 'chore: deps']);
  });

  it('falls back to newline splitting', () => {
    const raw = 'feat: add login\nfix: resolve crash';
    const result = parseMessages(raw);
    expect(result).toEqual(['feat: add login', 'fix: resolve crash']);
  });

  it('handles single message as last resort', () => {
    const raw = 'feat: add login';
    const result = parseMessages(raw);
    expect(result).toEqual(['feat: add login']);
  });

  it('returns empty array for empty input', () => {
    expect(parseMessages('')).toEqual([]);
  });

  it('limits to 3 messages', () => {
    const raw = '1. feat: one\n2. fix: two\n3. chore: three\n4. docs: four';
    const result = parseMessages(raw);
    expect(result.length).toBe(3);
  });

  it('filters out empty messages after cleaning', () => {
    const raw = '1. feat: add login\n2. fix: resolve crash\n3. ';
    const result = parseMessages(raw);
    expect(result.length).toBe(2);
    expect(result[0]).toBe('feat: add login');
    expect(result[1]).toBe('fix: resolve crash');
  });

  it('strips trailing colon from heading-like lines and keeps them', () => {
    const raw = '1. feat: add login\n2. chore: key changes:\n3. fix: resolve crash';
    const result = parseMessages(raw);
    expect(result).toEqual(['feat: add login', 'chore: key changes', 'fix: resolve crash']);
  });

  it('filters out bare type prefixes with no description', () => {
    const raw = '1. feat:\n2. feat: add login\n3. fix: resolve crash';
    const result = parseMessages(raw);
    expect(result).toEqual(['feat: add login', 'fix: resolve crash']);
  });
});

describe('normalizeMessage', () => {
  describe('conventional convention', () => {
    const conv = { type: 'conventional' };

    it('enforces lowercase', () => {
      expect(normalizeMessage('Feat: Add Login', conv)).toBe('feat: add login');
    });

    it('removes trailing period', () => {
      expect(normalizeMessage('feat: add login.', conv)).toBe('feat: add login');
    });

    it('does not truncate long messages', () => {
      const long = 'feat: ' + 'a'.repeat(200);
      const result = normalizeMessage(long, conv);
      expect(result).toBe(long);
    });

    it('infers type prefix when missing', () => {
      const result = normalizeMessage('added user login flow', conv);
      expect(result).toMatch(/^feat: /);
    });

    it('infers fix type from fix verb', () => {
      const result = normalizeMessage('fixed the null pointer bug', conv);
      expect(result).toMatch(/^fix: /);
    });

    it('defaults to feat when verb is unknown', () => {
      const result = normalizeMessage('miscellaneous changes to config', conv);
      expect(result).toMatch(/^feat: /);
    });

    it('preserves valid conventional format', () => {
      expect(normalizeMessage('feat(auth): add jwt tokens', conv)).toBe('feat(auth): add jwt tokens');
    });
  });

  describe('ticket-prefixed convention', () => {
    const conv = { type: 'ticket-prefixed', ticketPattern: 'PROJ-' };

    it('leaves casing as-is', () => {
      expect(normalizeMessage('PROJ-123 Add Login', conv)).toBe('PROJ-123 Add Login');
    });

    it('removes trailing period', () => {
      expect(normalizeMessage('PROJ-123 Add Login.', conv)).toBe('PROJ-123 Add Login');
    });
  });

  describe('imperative convention', () => {
    const conv = { type: 'imperative' };

    it('capitalizes first letter', () => {
      expect(normalizeMessage('add user login', conv)).toBe('Add user login');
    });

    it('strips accidental conventional prefix', () => {
      const result = normalizeMessage('feat: add user login', conv);
      expect(result).not.toMatch(/^feat:/);
      expect(result).toBe('Add user login');
    });

    it('removes trailing period', () => {
      expect(normalizeMessage('Add user login.', conv)).toBe('Add user login');
    });
  });

  describe('unknown/no convention', () => {
    it('defaults to conventional behavior', () => {
      const result = normalizeMessage('Added Login', { type: 'unknown' });
      expect(result).toMatch(/^feat: /);
    });

    it('handles undefined convention', () => {
      const result = normalizeMessage('feat: add login', undefined);
      expect(result).toBe('feat: add login');
    });
  });

  it('handles empty message', () => {
    expect(normalizeMessage('', { type: 'conventional' })).toBe('');
  });
});

describe('formatLongMessage', () => {
  it('returns short messages as-is', () => {
    expect(formatLongMessage('feat: add login')).toBe('feat: add login');
  });

  it('returns messages exactly 100 chars as-is', () => {
    const msg = 'feat: ' + 'a'.repeat(94);
    expect(msg.length).toBe(100);
    expect(formatLongMessage(msg)).toBe(msg);
  });

  it('splits long messages into subject + body', () => {
    const msg = 'feat: implement comprehensive user authentication system with JWT token rotation and refresh token management for enhanced security';
    const result = formatLongMessage(msg);
    expect(result).toContain('\n\n');
    const [subject] = result.split('\n\n');
    expect(subject.length).toBeLessThanOrEqual(72);
  });

  it('returns empty/null as-is', () => {
    expect(formatLongMessage('')).toBe('');
    expect(formatLongMessage(null)).toBe(null);
  });
});
