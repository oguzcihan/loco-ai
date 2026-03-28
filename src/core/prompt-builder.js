const CONVENTIONAL_TYPES = [
  'feat', 'fix', 'refactor', 'docs', 'style', 'test', 'chore', 'build', 'ci', 'perf', 'revert',
];

export function buildPrompt(diff, convention, mode = 'commit') {
  const sections = [];

  // Role — emphasize brevity and holistic summarization
  sections.push(
    'You are a commit message generator.\n' +
    'Write exactly 3 short, single-line commit messages for this diff.\n' +
    'Each message must describe the OVERALL purpose of the entire change.\n' +
    'Be concise. Maximum 72 characters each. One line per message.'
  );

  // Format rules based on convention
  sections.push(buildFormatRules(convention));

  // Shared rules
  sections.push(buildSharedRules(mode));

  // Convention examples
  sections.push(buildExamples(convention));

  // Anti-hallucination
  sections.push(
    'IMPORTANT: Output ONLY the 3 numbered messages. No explanations, no headers, no bullet points, no markdown, no code fences, no think tags, no backticks.\n' +
    'Each message is a COMPLETE single short line. Do NOT end with a colon. Do NOT write headings or section titles.\n' +
    'BAD: "refactor: improved error handling:"\n' +
    'GOOD: "refactor: improve error handling in commit command"'
  );

  // Diff
  sections.push(`Git diff:\n${diff}`);

  return sections.join('\n\n');
}

function buildFormatRules(convention) {
  switch (convention.type) {
    case 'conventional':
      return `STRICT FORMAT: type: description
Each message MUST start with one of these types followed by a colon:
  ${CONVENTIONAL_TYPES.map(t => `${t}:`).join(' ')}

You may optionally include a scope: type(scope): description

Choose the type that best represents the overall change:
- If the change adds new functionality or new files, use "feat:" (PREFERRED for new code)
- If it restructures or moves existing code without changing behavior, use "refactor:"
- If it fixes broken behavior or a bug, use "fix:"
- Use "chore:" ONLY for dependency updates, config changes, or CI/build tweaks
- Do NOT use "chore:" for new features — use "feat:" instead
- Do NOT label new code as "fix:" just because it adds validation or guards`;

    case 'ticket-prefixed': {
      const prefix = convention.ticketPattern || 'PROJ-';
      return `STRICT FORMAT: ${prefix}NNN description
Each message MUST start with a ticket identifier like ${prefix}123 followed by a space and a description.
Use realistic ticket numbers.`;
    }

    case 'imperative':
      return `STRICT FORMAT: Verb + description
Each message MUST start with an imperative verb (e.g., Add, Fix, Update, Remove, Refactor, Implement).
Capitalize the first letter. Do NOT use a type prefix like "feat:" or "fix:".`;

    default:
      return `STRICT FORMAT: type: description
Each message MUST start with one of these types followed by a colon:
  ${CONVENTIONAL_TYPES.map(t => `${t}:`).join(' ')}

You may optionally include a scope: type(scope): description

Choose the type that best represents the overall change:
- If the change adds new functionality or new files, use "feat:" (PREFERRED for new code)
- If it restructures or moves existing code without changing behavior, use "refactor:"
- If it fixes broken behavior or a bug, use "fix:"
- Use "chore:" ONLY for dependency updates, config changes, or CI/build tweaks
- Do NOT use "chore:" for new features — use "feat:" instead
- Do NOT label new code as "fix:" just because it adds validation or guards`;
  }
}

function buildSharedRules(mode) {
  const rules = [
    'STRICT: each message must be at most 72 characters',
    'Lowercase only',
    'No period at the end',
    'Single line per message — no bullet points, no explanations, no body text',
    'Summarize the WHOLE change, not individual files',
    'Respond with ONLY 3 numbered messages: 1. ... 2. ... 3. ...',
  ];

  if (mode === 'message') {
    rules.push(
      'If the change truly cannot be summarized in 72 chars, use max 100 characters'
    );
  }

  return `Rules:\n${rules.map(r => `- ${r}`).join('\n')}`;
}

function buildExamples(convention) {
  let examples;

  switch (convention.type) {
    case 'conventional':
      examples = [
        'feat(auth): add JWT refresh token rotation',
        'refactor(auth): restructure token handling with automatic refresh',
        'feat: implement secure session management with token rotation',
      ];
      break;

    case 'ticket-prefixed': {
      const prefix = convention.ticketPattern || 'PROJ-';
      examples = [
        `${prefix}142 add JWT refresh token rotation`,
        `${prefix}142 restructure token handling with automatic refresh`,
        `${prefix}142 implement secure session management`,
      ];
      break;
    }

    case 'imperative':
      examples = [
        'Add JWT refresh token rotation',
        'Restructure token handling with automatic refresh',
        'Implement secure session management with token rotation',
      ];
      break;

    default:
      examples = [
        'feat(auth): add JWT refresh token rotation',
        'refactor(auth): restructure token handling with automatic refresh',
        'feat: implement secure session management with token rotation',
      ];
      break;
  }

  let section = `Example output format (note: all 3 describe the SAME change differently):\n${examples.map((e, i) => `${i + 1}. ${e}`).join('\n')}`;

  // Include real samples from the repo if available
  if (convention.samples && convention.samples.length >= 2) {
    const repoExamples = convention.samples.slice(0, 3).map((s, i) => `  ${i + 1}. ${s}`).join('\n');
    section += `\n\nExamples from this repository (match this style):\n${repoExamples}`;
  }

  return section;
}
