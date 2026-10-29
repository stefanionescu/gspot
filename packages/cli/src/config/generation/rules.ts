export const RULES_HEADING = '# Rules';

export const FIRST_READ: readonly string[] = [
    'general/engineering/rules/WORKING.md',
    'general/prose/rules/WRITING.md',
    'general/engineering/rules/TALKING.md',
];

export const ALL_LEVEL_MARKER = '<!-- level: all -->';

export const BLANK_LINE = '\n\n';

export const RULE_OPENING_PREFIX = 'Read this rule ';

export const MARKDOWN_HEADING = /^(#{1,5}) /u;

export const SETTINGS_COMMANDS = ['set', 'unset', 'add', 'remove', 'ignore', 'unignore'] as const;

export const COMMANDS_HEADING = '## Commands';

export const GENERATED_FILES_HEADING = '## Generated files';

export const GSPOT_FOLDER_LINE = '- every file under `.gspot/`';

export const EDIT_KEYS_LINE = 'You can edit the other keys of that file.';

export const FIRST_READ_LINE = 'Read these rules first:';

export const RULE_INDEX_LINES = [
    'Read a rule below when its sentence fits your task.',
    'A rule marked `in <folder>/` applies only to files in that folder.',
    'A more specific rule wins over a general one.',
] as const;
