import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { LEVELS } from '#cli/config/manifests.ts';
import { openSession } from '#cli/engine/session.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { writeGeneratedFiles } from '#cli/generation/write.ts';
import { openFiles } from '#cli/system/files/open.ts';
import {
    COALESCING_CORRECTED,
    COALESCING_SOURCE,
    CONFIGURATION_RULE_OPTIONS,
    DOCUMENTED_PRICE_SOURCE,
} from '#tests/config/configurations/javascript/overrides.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import type { EslintConfiguration } from '#tests/types/setup.ts';

test.each(['all'] as const)('%s keeps the syntax selectors of a configuration inside its scope', async (level) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            level,
            scopes: [{ path: 'app', configurations: ['react', 'drizzle'] }],
        }),
        'package.json': '{"private":true,"type":"module"}',
        'root.jsx': '',
        'app/client.jsx': '',
    });

    const eslint = await buildEslint(sandbox.path);
    const source = 'await db.execute(sql`select 1`);';
    await createFileTree(sandbox.path, { 'app/client.jsx': source, 'root.jsx': source });
    expect(await listLintFindings(eslint, sandbox.path, ['app/client.jsx'], ['gspot/restricted-syntax'])).toStrictEqual(
        [{ file: 'app/client.jsx', rule: 'gspot/restricted-syntax', line: 1 }],
    );
    expect(await listLintFindings(eslint, sandbox.path, ['root.jsx'], ['gspot/restricted-syntax'])).toStrictEqual([]);
});

test('level all keeps every rule that level basic turns on for a React file', async () => {
    const rules: Record<string, EslintConfiguration['rules']> = {};
    for (const level of LEVELS) {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['react'], { level }),
            'package.json': '{"private":true,"type":"module"}',
            'client.jsx': '',
        });
        const eslint = await buildEslint(sandbox.path);
        const config = (await eslint.calculateConfigForFile('client.jsx')) as EslintConfiguration;
        rules[level] = config.rules;
    }
    const active = Object.entries(rules['basic']!).filter(([, value]) => Array.isArray(value) && value[0] !== 0);
    expect(active.map(([name]) => name)).toContain('@eslint-react/no-missing-key');
    for (const [name] of active) expect((rules['all']![name] as unknown[])[0], name).not.toBe(0);
});

test('all applies your rule options except in script and test files', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            level: 'all',
            tables: '[limits.javascript]\ntrivial_function_statements = 4\n[tools.eslint.rules]\n"n/no-process-exit" = []\n"n/no-unpublished-import" = []\n',
        }),
        'package.json': '{"private":true,"type":"module"}',
        'source.js': '',
        'scripts/run.js': '',
        'tests/example.test.js': '',
    });

    const eslint = await buildEslint(sandbox.path);
    const source = (await eslint.calculateConfigForFile('source.js')) as EslintConfiguration;
    const script = (await eslint.calculateConfigForFile('scripts/run.js')) as EslintConfiguration;
    const testFile = (await eslint.calculateConfigForFile('tests/example.test.js')) as EslintConfiguration;
    expect(source.rules['n/no-process-exit']![0]).toBe(2);
    expect(script.rules['n/no-process-exit']![0]).toBe(0);
    expect(testFile.rules['n/no-unpublished-import']![0]).toBe(0);
});

test.each(LEVELS)('ESLint refuses options for a rule that no block turns on at level %s', async (level) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            level,
            tables: '[tools.eslint.rules]\n"id-length" = []\n"acme/foo" = []\n',
        }),
        'package.json': '{"private":true,"type":"module"}',
        'source.js': '',
    });
    const eslint = await buildEslint(sandbox.path);
    expect(await captureRejection(eslint.calculateConfigForFile('source.js'))).toMatchObject({
        message: [
            `gspot does not run id-length at level ${level}, so it takes no options. For a rule of your own, add a [[tools.eslint.plugins]] record.`,
            `gspot does not run acme/foo at level ${level}, so it takes no options. For a rule of your own, add a [[tools.eslint.plugins]] record.`,
        ].join('\n'),
    });
});

test('--fix keeps a suppression for a rule that level basic does not run', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], { level: 'basic' }),
        'package.json': '{"private":true,"type":"module"}',
        'source.js': '',
    });
    const eslint = await buildEslint(sandbox.path, { fix: true });
    const source =
        '// eslint-disable-next-line max-lines-per-function -- reason: The table reads best in one place.\nexport const value = 1;\n';
    const [fixed] = await eslint.lintText(source, { filePath: 'source.js' });
    expect(fixed?.output).toBeUndefined();
    expect(fixed?.messages).toStrictEqual([]);
});

test.each(LEVELS)('empty-object fallbacks are reported at level %s and pass after correction', async (level) => {
    await using sandbox = await createGitSandbox({});
    const settings = buildSandboxSettings(['javascript'], { level });
    await createFileTree(sandbox.path, {
        'gspot.toml': settings,
        'package.json': '{"private":true,"type":"module"}',
        'source.js': COALESCING_SOURCE,
    });
    const eslint = await buildEslint(sandbox.path);
    expect(await listLintFindings(eslint, sandbox.path, ['source.js'], ['gspot/restricted-syntax'])).toStrictEqual([
        { file: 'source.js', rule: 'gspot/restricted-syntax', line: 2 },
        { file: 'source.js', rule: 'gspot/restricted-syntax', line: 3 },
    ]);
    await writeFile(join(sandbox.path, 'source.js'), COALESCING_CORRECTED);
    expect(await listLintFindings(eslint, sandbox.path, ['source.js'], ['gspot/restricted-syntax'])).toStrictEqual([]);
});

test.each([
    ['vitest', 'vitest/valid-title'],
    ['jest', 'jest/valid-title'],
])('%s at level all refuses a title that says nothing or names a removal', async (configuration, rule) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([configuration], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}',
        'tests/sum.test.js':
            "test('works', () => {});\ntest('no longer takes a callback', () => {});\ntest('adds two numbers', () => {});\n",
    });
    const eslint = await buildEslint(sandbox.path);
    const findings = await listLintFindings(eslint, sandbox.path, ['tests/sum.test.js'], [rule]);
    expect(findings.map(({ line }) => line)).toStrictEqual([1, 2]);
});

test('switching the level and back writes the same files', async () => {
    await using sandbox = await createGitSandbox({});
    await writeFile(join(sandbox.path, 'source.js'), 'export const value = 1;\n');
    const outputs: Array<Array<{ path: string; content: string }>> = [];
    for (const level of ['basic', 'all', 'basic'] as const) {
        const settings = buildSandboxSettings(['javascript'], { rules: true, level });
        await writeFile(join(sandbox.path, 'gspot.toml'), settings);
        const session = await openSession(sandbox.path);
        const output = buildGeneratedFiles(session);
        const writer = openFiles(sandbox.path);
        await writeGeneratedFiles(session, output, writer);
        outputs.push(output.files.map(({ path, content }) => ({ path, content })));
    }
    expect(outputs[1]).not.toStrictEqual(outputs[0]);
    expect(outputs[2]).toStrictEqual(outputs[0]);
});

test.each(['all'] as const)(
    '%s asks for a blank line between a description and its tags only at level all',
    async (level) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['javascript'], { level }),
            'package.json': '{"private":true,"type":"module"}',
            'total.js': DOCUMENTED_PRICE_SOURCE,
        });

        const eslint = await buildEslint(sandbox.path, { fix: true });
        const [result] = await eslint.lintFiles(['total.js']);
        expect(result?.output?.split('\n').slice(0, 3)).toStrictEqual(['/**', 'Add the two prices.', '']);
    },
);

test('your options for a rule that a configuration adds, such as @typescript-eslint/no-floating-promises, reach the ESLint file at level all', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript', 'typescript'], {
            level: 'all',
            tables: CONFIGURATION_RULE_OPTIONS.tables,
        }),
        ...CONFIGURATION_RULE_OPTIONS.files,
    });
    const eslint = await buildEslint(sandbox.path);
    expect(
        await listLintFindings(eslint, sandbox.path, ['source.ts'], ['@typescript-eslint/no-floating-promises']),
    ).toStrictEqual([{ file: 'source.ts', rule: '@typescript-eslint/no-floating-promises', line: 2 }]);
});

test.each(['basic'] as const)('%s keeps core bug checks and TypeScript recommended checks active', async (level) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript', 'typescript'], {
            level,
            tables: '[[tools.eslint.override]]\npaths = ["**/*.js", "**/*.ts"]\nruntime = "browser"\n',
        }),
        'package.json': '{"private":true,"type":"module"}',
        'source.js': '',
        'source.ts': '',
    });
    const eslint = await buildEslint(sandbox.path);
    for (const file of ['source.js', 'source.ts']) {
        const config = (await eslint.calculateConfigForFile(file)) as EslintConfiguration;
        const rules = [
            'no-self-compare',
            file.endsWith('.js') ? 'no-implied-eval' : '@typescript-eslint/no-explicit-any',
        ];
        expect(Object.fromEntries(rules.map((name) => [name, config.rules[name]?.[0]]))).toStrictEqual(
            Object.fromEntries(rules.map((name) => [name, 2])),
        );
    }
});

test.each(LEVELS)('level %s reports the unicorn style rules only at level all', async (level) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], { level }),
        'package.json': '{"private":true,"type":"module"}',
        'style.js': [
            "import { EventEmitter } from 'node:events';",
            'export const readLast = (values) => values[values.length - 1];',
            'export const sum = (values) => { let total = 0; values.forEach((value) => { total += value; }); return total; };',
            'export const isMissing = (value) => isNaN(value);',
            'export const pick = (ready) => { if (!ready) { return 0; } else { return 1; } };',
            "export const greet = (name) => { name = name || 'guest'; return name; };",
            'export class Bus extends EventEmitter {}',
        ].join('\n'),
    });
    const rules = [
        'unicorn/prefer-at',
        'unicorn/no-for-each',
        'unicorn/prefer-number-properties',
        'unicorn/no-negated-condition',
        'unicorn/prefer-default-parameters',
        'unicorn/prefer-event-target',
    ];
    const eslint = await buildEslint(sandbox.path);
    const findings = await listLintFindings(eslint, sandbox.path, ['style.js'], rules);
    expect(findings.map(({ rule, line }) => [line, rule])).toStrictEqual(
        level === 'all' ? rules.map((rule, index) => [index + 2, rule]) : [],
    );
});
