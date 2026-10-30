import { GSPOT_PATHS } from '#cli/config/files/gspot.ts';

export const EDITORCONFIG_SAMPLES = [
    {
        file: 'line-endings.txt',
        broken: 'content\r\n',
        corrected: 'content\n',
        lines: [undefined, undefined],
    },
    {
        file: 'final-newline.txt',
        broken: 'content',
        corrected: 'content\n',
        lines: [undefined],
    },
    {
        file: 'trailing-whitespace.txt',
        broken: 'content \n',
        corrected: 'content\n',
        lines: [1],
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
