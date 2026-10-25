import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';

export const EDITORCONFIG_SAMPLES = [
    {
        file: 'line-endings.txt',
        broken: 'content\r\n',
        corrected: 'content\n',
        findings: [
            { line: undefined, message: 'not all lines have the correct end of line character' },
            { line: undefined, message: 'wrong line endings or no final newline' },
        ],
    },
    {
        file: 'final-newline.txt',
        broken: 'content',
        corrected: 'content\n',
        findings: [{ line: undefined, message: 'wrong line endings or no final newline' }],
    },
    {
        file: 'trailing-whitespace.txt',
        broken: 'content \n',
        corrected: 'content\n',
        findings: [{ line: 1, message: 'trailing whitespace' }],
    },
] as const;

export const STAGED_FORMAT_SOURCE = {
    staged: 'export const value = {\n  value: {\n    active: false,\n  },\n};\n',
    working: 'export const value = {\n    value: {\n        active: false,\n    },\n};\n',
} as const;

export const STAGED_FORMAT_PATHS = {
    source: 'app/value.js',
    scopeConfig: `${GSPOT_PATHS.configurations}/general/format/scopes/app/prettier.json`,
} as const;

export const STAGED_FORMAT_CHECK_ARGUMENTS = [
    'check',
    '--staged',
    '--only',
    'format/prettier',
    '--json',
    '--',
    'app/value.js',
] as const;
