export const RULES_HEADING = '# Rules';

export const FIRST_READ: readonly string[] = [
    'general/engineering/rules/WORKING.md',
    'general/prose/rules/WRITING.md',
    'general/engineering/rules/TALKING.md',
];

export const RULE_FILE_PATTERN = /^[A-Z0-9-]+\.md$/u;

export const AGENTS_FILE = 'AGENTS.md';

export const ALL_LEVEL_MARKER = '<!-- level: all -->';

export const RULE_OPENING_PREFIX = 'Read this rule ';

/** A Markdown heading line, with its marks captured. */
export const MARKDOWN_HEADING = /^(#{1,5}) /u;
