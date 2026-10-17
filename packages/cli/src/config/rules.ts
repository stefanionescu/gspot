export const RULES_HEADING = '# Rules';

export const FIRST_READ: readonly string[] = [
    'general/engineering/agent/WORKING.md',
    'general/prose/WRITING.md',
    'general/engineering/agent/TALKING.md',
];

export const RULE_FILE_PATTERN = /^[A-Z0-9-]+\.md$/u;

export const AGENTS_FILE = 'AGENTS.md';

export const ALL_LEVEL_MARKER = '<!-- level: all -->';

/** gspot 0.2.0 and 0.2.1 wrote an `@AGENTS.md` block into this file; apply removes it. */
export const CLAUDE_FILE = 'CLAUDE.md';
export const RULE_OPENING_PREFIX = 'Read this rule ';
