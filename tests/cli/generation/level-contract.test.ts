import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { parse as parseToml } from 'smol-toml';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { emitFile } from '#tests/harness/generated.ts';
import { openSession } from '#cli/commands/session.ts';
import { writeOutputs } from '#cli/lifecycle/apply.ts';
import { parseStrictPolicy } from '#cli/policy/read.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import type { RuffConfiguration } from '#tests/types/generation/configuration-files.ts';

import {
    RUFF_PREVIEW_RULES,
    ESLINT_REJECTED_SELECTIONS,
    UNSUPPORTED_PYTHON_OPTIONS,
    MARKDOWNLINT_REJECTED_SELECTIONS,
} from '#tests/config/cli/generation/level-contract.ts';

test('a scope resolves its own tool settings over the root defaults', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['python', 'pytest'], {
            tables: '[scope."app"]\nconfigurations = []\n[scope."app".coverage]\nlines = 91\n[scope."app".tools.ruff]\ndocstring_convention = "numpy"\n',
            level: 'all',
        }),
        'app/main.py': 'value = 1\n',
    });
    const session = await openSession(sandbox.path);
    const nested = session.scopes.find((scope) => scope.scope.path === 'app')!;
    expect(nested.view.settings['coverage.lines']).toBe(91);
    expect(nested.view.settings['tools.ruff.docstring_convention']).toBe('numpy');
});

test.each(['recommended', 'all'] as const)('%s Ruff selects stable rules with preview disabled', async (level) => {
    const text = await emitFile(
        buildPolicy(['python', 'fastapi', 'pytest'], { level: level }),
        '.gspot/config/ruff.toml',
        {
            'sample.py': 'value = 1',
        },
    );
    const config = parseToml(text) as RuffConfiguration;
    expect(config.lint.select.filter((code) => RUFF_PREVIEW_RULES.has(code))).toStrictEqual([]);
    expect(config.lint.select.includes('N802')).toBe(level === 'all');
    expect(config.lint.select.includes('PT001')).toBe(level === 'all');
    expect(config.lint.select).toContain('PT009');
    expect(config.lint.select).toContain('FAST003');
    for (const code of ['C901', 'PLR2004', 'ERA001', 'T201', 'T203'])
        expect(config.lint.select.includes(code), code).toBe(level === 'all');
    expect(config.lint.select).not.toContain('PLR0915');
    const types = await emitFile(buildPolicy(['python'], { level }), '.gspot/config/basedpyrightconfig.json', {
        'sample.py': 'value = 1',
    });
    expect(JSON.parse(types)).toHaveProperty('reportImportCycles', level === 'all' ? 'error' : 'none');
    for (const rule of [
        'reportUnusedImport',
        'reportUnusedVariable',
        'reportRedeclaration',
        'reportUndefinedVariable',
        'reportIgnoreCommentWithoutRule',
        'reportPrivateUsage',
        'reportSelfClsParameterName',
    ])
        expect(JSON.parse(types)).toHaveProperty(rule, 'none');
});

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

test('switching levels restores generated defaults and agent instructions', async () => {
    await using sandbox = await testdir();
    await Bun.write(join(sandbox.path, 'source.js'), 'export const value = 1;\n');
    const outputs: string[] = [];
    for (const level of ['recommended', 'all', 'recommended'] as const) {
        const policy = buildPolicy(['javascript'], { level: level });
        await Bun.write(join(sandbox.path, 'gspot.toml'), policy);
        const session = await openSession(sandbox.path);
        const output = emitAll(session);
        const config = output.files.find((file) => file.path.endsWith('/eslint.config.mjs'))!;
        using log = openOwnership(sandbox.path);
        writeOutputs(session, log, undefined, output);
        const block = output.blocks.find((block) => block.path === 'AGENTS.md')!.block;
        expect(block).toContain(`Selected level: \`${level}\``);
        outputs.push(config.content);
    }
    expect(outputs[0]).not.toBe(outputs[1]);
    expect(outputs[2]).toBe(outputs[0]);
});

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
