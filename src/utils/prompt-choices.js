const DEFAULT_TERMINAL_WIDTH = 80;
const DEFAULT_TERMINAL_HEIGHT = 24;
const PROMPT_PREFIX_WIDTH = 2;

export function wrapText(text, width) {
  const maxWidth = Math.max(1, width);
  const words = text.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) return [''];

  const lines = [];
  let current = '';

  for (const word of words) {
    if (!current) {
      if (word.length <= maxWidth) {
        current = word;
      } else {
        const chunks = splitLongWord(word, maxWidth);
        lines.push(...chunks.slice(0, -1));
        current = chunks.at(-1) || '';
      }
      continue;
    }

    const next = `${current} ${word}`;
    if (next.length <= maxWidth) {
      current = next;
      continue;
    }

    lines.push(current);

    if (word.length <= maxWidth) {
      current = word;
    } else {
      const chunks = splitLongWord(word, maxWidth);
      lines.push(...chunks.slice(0, -1));
      current = chunks.at(-1) || '';
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

export function formatMessageChoice(message, index, terminalWidth = DEFAULT_TERMINAL_WIDTH) {
  const label = `${index}. `;
  const contentWidth = Math.max(1, terminalWidth - PROMPT_PREFIX_WIDTH - label.length);
  const continuationIndent = ' '.repeat(PROMPT_PREFIX_WIDTH + label.length);
  const lines = wrapText(message, contentWidth);

  return lines
    .map((line, lineIndex) => (lineIndex === 0 ? `${label}${line}` : `${continuationIndent}${line}`))
    .join('\n');
}

export function buildMessageChoices(messages, extraChoices = [], output = process.stdout) {
  const width = getTerminalWidth(output);
  const choices = messages.map((message, index) => ({
    name: formatMessageChoice(message, index + 1, width),
    short: message,
    value: message,
  }));

  const allChoices = [...choices, ...extraChoices];
  return {
    choices: allChoices,
    pageSize: getPageSize(allChoices, output),
  };
}

function splitLongWord(word, width) {
  const parts = [];
  for (let start = 0; start < word.length; start += width) {
    parts.push(word.slice(start, start + width));
  }
  return parts;
}

function getTerminalWidth(output) {
  if (Number.isInteger(output?.columns) && output.columns > 0) {
    return output.columns;
  }
  return DEFAULT_TERMINAL_WIDTH;
}

function getTerminalHeight(output) {
  if (Number.isInteger(output?.rows) && output.rows > 0) {
    return output.rows;
  }
  return DEFAULT_TERMINAL_HEIGHT;
}

function countLines(choice) {
  if (!choice?.name) return 1;
  return String(choice.name).split('\n').length;
}

function getPageSize(choices, output) {
  const totalLines = choices.reduce((sum, choice) => sum + countLines(choice), 0);
  const availableRows = Math.max(3, getTerminalHeight(output) - 3);
  return Math.max(3, Math.min(totalLines, availableRows));
}
