export const RULES_HEADING = '# Rules';

export const FIRST_READ: readonly string[] = [
    'general/engineering/rules/WORKING.md',
    'general/prose/rules/WRITING.md',
    'general/engineering/rules/TALKING.md',
];

export const ALL_LEVEL_MARKER = '<!-- level: all -->';

/** The blank line around a level marker, which leaves with the marker at level all. */
export const BLANK_LINE = '\n\n';

export const RULE_OPENING_PREFIX = 'Read this rule ';

export const MARKDOWN_HEADING = /^(#{1,5}) /u;

/** The commands that change gspot.toml. */
export const SETTINGS_COMMANDS = ['set', 'unset', 'add', 'remove', 'ignore', 'unignore'] as const;
