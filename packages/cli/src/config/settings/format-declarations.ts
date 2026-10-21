import type { SettingMetadata } from '#cli/types/settings/metadata.ts';

export const FORMAT_DECLARATIONS = {
    'format.indent_style': {
        configurations: ['format'],
        description: 'The character of one indent level: space or tab.',
        default: 'space',
    },
    'format.indent_width': {
        configurations: ['format'],
        description: 'Spaces per indent level.',
        default: 4,
    },
    'format.print_width': {
        configurations: ['format'],
        description: 'The line width formatters wrap at.',
        default: 120,
    },
    'format.line_ending': {
        configurations: ['format'],
        description: 'The line ending every file uses: lf or crlf.',
        default: 'lf',
    },
    'format.final_newline': {
        configurations: ['format'],
        description: 'Whether every file ends with a newline.',
        default: true,
    },
    'format.quotes': {
        configurations: ['format'],
        description:
            'Single or double, for the languages where a formatter chooses. Unset, Python gets double quotes and the other languages single.',
    },
    'format.trailing_commas': {
        configurations: ['format'],
        description: 'Where trailing commas go: all, es5, or none.',
        default: 'all',
    },
    'format.semicolons': {
        configurations: ['format'],
        description: 'Whether JavaScript and TypeScript statements end with semicolons.',
        default: true,
    },
    'format.override': {
        configurations: ['format'],
        description: 'Formatting options for repository-relative paths, in order.',
        default: [] as [],
    },
} as const satisfies Record<string, SettingMetadata>;
