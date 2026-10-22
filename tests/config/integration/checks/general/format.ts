/** EditorConfig findings that formatters do not replace. */

import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

export const EDITORCONFIG_SAMPLES = [
    { file: 'line-endings.txt', broken: 'content\r\n', corrected: 'content\n' },
    { file: 'final-newline.txt', broken: 'content', corrected: 'content\n' },
    { file: 'trailing-whitespace.txt', broken: 'content \n', corrected: 'content\n' },
] as const;

/** A staged format check uses the root config file until a later apply writes the scope config file. */
export const STAGED_FORMAT_FILES = {
    'gspot.toml': buildSandboxSettings(['format'], {
        tables: '[format]\nindent_width = 2\n[rules]\nenabled = false\n',
        scopes: [{ path: 'app' }],
    }),
    'app/value.js': 'export const value = {\n  value: {\n    active: true,\n  },\n};\n',
} as const;

export const STAGED_FORMAT_SOURCE = {
    staged: 'export const value = {\n  value: {\n    active: false,\n  },\n};\n',
    working: 'export const value = {\n    value: {\n        active: false,\n    },\n};\n',
} as const;

export const STAGED_FORMAT_PATHS = {
    source: 'app/value.js',
    rootConfig: '.gspot/configurations/general/format/prettier.json',
    scopeConfig: '.gspot/configurations/general/format/scopes/app/prettier.json',
    settings: 'gspot.toml',
} as const;

export const STAGED_FORMAT_CHANGE_ARGUMENTS = ['set', 'format.indent_width', '4', '--scope', 'app'] as const;

export const STAGED_FORMAT_CHECK_ARGUMENTS = [
    'check',
    '--staged',
    '--only',
    'format/prettier',
    '--json',
    '--',
    'app/value.js',
] as const;
