import { test, expect } from 'bun:test';
import { buildPolicy } from '#tests/harness/policy.ts';
import { parseStrictPolicy } from '#cli/policy/public.ts';

import {
    ESLINT_REJECTED_SELECTIONS,
    UNSUPPORTED_PYTHON_OPTIONS,
    MARKDOWNLINT_REJECTED_SELECTIONS,
} from '#tests/config/cli/policy/read/tools.ts';

test.each(UNSUPPORTED_PYTHON_OPTIONS.flatMap((entry) => ['', 'app'].map((scope) => ({ ...entry, scope }))))(
    '$tool refuses $options with scope=$scope',
    ({ scope, tool, options, diagnostic }) => {
        const prefix = scope === '' ? '' : `scope.${scope}.`;
        const source = buildPolicy(['python'], {
            agentRules: true,
            tables: `[${prefix}tools.${tool}.verbatim]\n${options}\n`,
        });
        expect(() => parseStrictPolicy(source)).toThrow(diagnostic.replace('[tools', `[${prefix}tools`));
    },
);

test('keeps ShellCheck rule selection with its coverage level and ignores', () => {
    for (const scope of ['', '[scope."app"]\n']) {
        const table = scope === '' ? 'tools' : 'scope.app.tools';
        for (const option of ['enable = "all"', 'disable = "SC2086"'])
            expect(() =>
                parseStrictPolicy(
                    buildPolicy(['bash'], {
                        agentRules: true,
                        tables: `${scope}[${table}.shellcheck.verbatim]\n${option}`,
                    }),
                ),
            ).toThrow('ShellCheck rule selection');
    }
});

test('refuses authored ESLint coverage choices in root and scoped native options', () => {
    for (const scope of ['', '[scope."app"]\n']) {
        const table = scope === '' ? 'tools' : 'scope.app.tools';
        for (const selection of ESLINT_REJECTED_SELECTIONS) {
            const tables = `${scope}[${table}.eslint.rules]\neqeqeq = ${selection}\n`;
            expect(() => parseStrictPolicy(buildPolicy(['javascript'], { agentRules: true, tables }))).toThrow(
                'ESLint rule selection',
            );
        }
        for (const key of ['rules', 'overrides', 'extends']) {
            const tables = `${scope}[${table}.eslint.verbatim]\n${key} = []\n`;
            expect(() => parseStrictPolicy(buildPolicy(['javascript'], { agentRules: true, tables }))).toThrow(
                'ESLint rule selection',
            );
        }
    }
});

test('refuses authored Markdown coverage choices in root and scoped settings', () => {
    for (const scope of ['', '[scope."app"]\n']) {
        const table = scope === '' ? 'tools' : 'scope.app.tools';
        for (const selection of MARKDOWNLINT_REJECTED_SELECTIONS)
            expect(() =>
                parseStrictPolicy(
                    buildPolicy(['markdown'], {
                        agentRules: true,
                        tables: `${scope}[${table}.markdownlint.rules]\n${selection}\n`,
                    }),
                ),
            ).toThrow('Markdownlint rule selection');
        expect(() =>
            parseStrictPolicy(
                buildPolicy(['markdown'], {
                    agentRules: true,
                    tables: `${scope}[${table}.markdownlint.verbatim]\ndefault = true\n`,
                }),
            ),
        ).toThrow('verbatim');
    }
});

test('refuses authored Stylelint warning severity in root and scoped native options', () => {
    for (const scope of ['', '[scope."app"]\n']) {
        const table = scope === '' ? 'tools' : 'scope.app.tools';
        const tables = `${scope}[${table}.stylelint.rules]\ncolor-hex-length = ["short", { severity = "warning" }]\n`;
        expect(() => parseStrictPolicy(buildPolicy(['css'], { agentRules: true, tables }))).toThrow(
            'Stylelint rule selection',
        );
    }
});

test('native rule options preserve path-dependent diagnostics and nested JSON validation', () => {
    for (const scope of ['', 'app']) {
        const prefix = scope === '' ? '' : 'scope.app.';
        for (const key of ['ordinary', '__proto__', 'constructor', 'prototype', 'toString']) {
            const commitlint = buildPolicy(['commits'], {
                agentRules: true,
                tables: `[${prefix}tools.commitlint.rules]\n"${key}" = ["invalid"]\n`,
            });
            expect(() => parseStrictPolicy(commitlint)).toThrow(`--rule ${key}`);
            const eslint = buildPolicy(['javascript'], {
                agentRules: true,
                tables: `[${prefix}tools.eslint.rules]\n"project/rule" = [{ "${key}" = 2026-10-09 }]\n`,
            });
            expect(() => parseStrictPolicy(eslint)).toThrow('ESLint rule selection');
            const yamllint = buildPolicy(['files'], {
                agentRules: true,
                tables: `[${prefix}tools.yamllint.rules]\n"${key}" = 5\n`,
            });
            expect(() => parseStrictPolicy(yamllint)).toThrow(`--rule ${key}`);
        }
    }
});
