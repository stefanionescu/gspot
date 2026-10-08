import { test, expect } from 'bun:test';
import { buildPolicy } from '#tests/harness/policy.ts';
import { parseStrictPolicy } from '#cli/policy/read.ts';

import {
    ESLINT_REJECTED_SELECTIONS,
    UNSUPPORTED_PYTHON_OPTIONS,
    MARKDOWNLINT_REJECTED_SELECTIONS,
} from '#tests/config/cli/policy/read/tools.ts';

test.each(['recommended', 'all'] as const)('%s refuses unsupported Python verbatim options in every scope', (level) => {
    for (const scope of ['', 'app']) {
        const prefix = scope === '' ? '' : `scope.${scope}.`;
        for (const { tool, options, diagnostic } of UNSUPPORTED_PYTHON_OPTIONS) {
            const source = buildPolicy(['python'], {
                level,
                tables: `[${prefix}tools.${tool}.verbatim]\n${options}\n`,
            });
            expect(() => parseStrictPolicy(source)).toThrow(diagnostic.replace('[tools', `[${prefix}tools`));
        }
    }
});

test.each(['recommended', 'all'] as const)(
    '%s keeps ShellCheck rule selection with its coverage level and ignores',
    (level) => {
        for (const scope of ['', '[scope."app"]\n']) {
            const table = scope === '' ? 'tools' : 'scope.app.tools';
            for (const option of ['enable = "all"', 'disable = "SC2086"'])
                expect(() =>
                    parseStrictPolicy(
                        buildPolicy(['bash'], {
                            level,
                            tables: `${scope}[${table}.shellcheck.verbatim]\n${option}`,
                        }),
                    ),
                ).toThrow('ShellCheck rule selection');
        }
    },
);

test.each(['recommended', 'all'] as const)(
    '%s refuses authored ESLint coverage choices in root and scoped native options',
    (level) => {
        for (const scope of ['', '[scope."app"]\n']) {
            const table = scope === '' ? 'tools' : 'scope.app.tools';
            for (const selection of ESLINT_REJECTED_SELECTIONS) {
                const tables = `${scope}[${table}.eslint.rules]\neqeqeq = ${selection}\n`;
                expect(() => parseStrictPolicy(buildPolicy(['javascript'], { level, tables }))).toThrow(
                    'ESLint rule selection',
                );
            }
            for (const key of ['rules', 'overrides', 'extends']) {
                const tables = `${scope}[${table}.eslint.verbatim]\n${key} = []\n`;
                expect(() => parseStrictPolicy(buildPolicy(['javascript'], { level, tables }))).toThrow(
                    'ESLint rule selection',
                );
            }
        }
    },
);

test.each(['recommended', 'all'] as const)(
    '%s refuses authored Markdown coverage choices in root and scoped settings',
    (level) => {
        for (const scope of ['', '[scope."app"]\n']) {
            const table = scope === '' ? 'tools' : 'scope.app.tools';
            for (const selection of MARKDOWNLINT_REJECTED_SELECTIONS)
                expect(() =>
                    parseStrictPolicy(
                        buildPolicy(['markdown'], {
                            level,
                            tables: `${scope}[${table}.markdownlint.rules]\n${selection}\n`,
                        }),
                    ),
                ).toThrow('Markdownlint rule selection');
            expect(() =>
                parseStrictPolicy(
                    buildPolicy(['markdown'], {
                        level,
                        tables: `${scope}[${table}.markdownlint.verbatim]\ndefault = true\n`,
                    }),
                ),
            ).toThrow('verbatim');
        }
    },
);

test.each(['recommended', 'all'] as const)(
    '%s refuses authored Stylelint warning severity in root and scoped native options',
    (level) => {
        for (const scope of ['', '[scope."app"]\n']) {
            const table = scope === '' ? 'tools' : 'scope.app.tools';
            const tables = `${scope}[${table}.stylelint.rules]\ncolor-hex-length = ["short", { severity = "warning" }]\n`;
            expect(() => parseStrictPolicy(buildPolicy(['css'], { level, tables }))).toThrow(
                'Stylelint rule selection',
            );
        }
    },
);
