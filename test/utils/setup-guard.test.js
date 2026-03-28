import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock config module before importing setup-guard
vi.mock('../../src/utils/config.js', () => ({
  getConfig: vi.fn(),
}));

// Mock chalk to avoid ESM issues in test
vi.mock('chalk', () => ({
  default: {
    red: (s) => s,
    cyan: (s) => s,
  },
}));

const { getConfig } = await import('../../src/utils/config.js');
const { requireSetup } = await import('../../src/utils/setup-guard.js');

describe('requireSetup', () => {
  let exitSpy;
  let errorSpy;

  beforeEach(() => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('returns config when setup is complete', () => {
    const config = { setupComplete: true, defaultModel: 'qwen2.5-coder:1.5b' };
    getConfig.mockReturnValue(config);

    const result = requireSetup();
    expect(result).toEqual(config);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('exits with code 1 when setup is not complete', () => {
    getConfig.mockReturnValue({ setupComplete: false, defaultModel: 'qwen2.5-coder:1.5b' });

    expect(() => requireSetup()).toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('prints setup required message when not complete', () => {
    getConfig.mockReturnValue({ setupComplete: false, defaultModel: 'qwen2.5-coder:1.5b' });

    try { requireSetup(); } catch { /* expected */ }
    expect(errorSpy).toHaveBeenCalled();
    const msg = errorSpy.mock.calls[0].join(' ');
    expect(msg).toContain('Setup required');
    expect(msg).toContain('loco setup');
  });
});
