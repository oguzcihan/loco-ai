import { describe, it, expect } from 'vitest';
import { wrapText, formatMessageChoice, buildMessageChoices } from '../../src/utils/prompt-choices.js';

describe('wrapText', () => {
  it('wraps on word boundaries when the line is narrow', () => {
    expect(wrapText('feat: detect commit style used in repo', 18)).toEqual([
      'feat: detect',
      'commit style used',
      'in repo',
    ]);
  });

  it('splits long words that exceed the available width', () => {
    expect(wrapText('supercalifragilisticexpialidocious', 10)).toEqual([
      'supercalif',
      'ragilistic',
      'expialidoc',
      'ious',
    ]);
  });
});

describe('formatMessageChoice', () => {
  it('indents continuation lines so wrapped choices stay aligned', () => {
    expect(formatMessageChoice('feat: detect commit style used in repo history', 2, 24)).toBe(
      '2. feat: detect commit\n' +
      '     style used in repo\n' +
      '     history'
    );
  });
});

describe('buildMessageChoices', () => {
  it('increases page size to account for wrapped choice lines', () => {
    const output = { columns: 28, rows: 20 };
    const messages = [
      'refactor: commit and message commands move logic to new modules',
      'feat: detect the commit style used in the repository history',
      'chore: normalize generated messages to lowercase output',
    ];

    const { choices, pageSize } = buildMessageChoices(messages, [], output);

    expect(choices[0].name.split('\n').length).toBeGreaterThan(1);
    expect(choices[1].name.split('\n').length).toBeGreaterThan(1);
    expect(pageSize).toBeGreaterThan(messages.length);
  });

  it('keeps the selected short value as the original message', () => {
    const message = 'feat: add message picker';
    const { choices } = buildMessageChoices([message], [], { columns: 80, rows: 24 });

    expect(choices[0].short).toBe(message);
    expect(choices[0].value).toBe(message);
  });
});
