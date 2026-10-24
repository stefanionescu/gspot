import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { generate } from '#cli/generation/generate.ts';
import { openWriter } from '#cli/apply/write/writer.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { LEVELS } from '#cli/config/configurations/names.ts';
import type { EslintConfiguration } from '#tests/types/tools.ts';
import { writeGeneratedFiles } from '#cli/apply/files/generated.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';

import {
    COALESCING_SOURCE,
    LEVEL_RULE_OPTIONS,
    COALESCING_CORRECTED,
    UNAPPLIED_RULE_OPTIONS,
    UNAPPLIED_RULE_REFUSALS,
    DOCUMENTED_PRICE_SOURCE,
    CONFIGURATION_RULE_OPTIONS,
} from '#tests/config/generation/configurations/language/javascript/eslint/levels.ts';

test.each([...LEVELS])('%s keeps framework rules and syntax selectors inside their scope', async (level) => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            level,
            scopes: [{ path: 'app', configurations: ['react', 'drizzle'] }],
        }),
        'package.json': '{"private":true,"type":"module"}',
        'root.jsx': '',
        'app/client.jsx': '',
    });

    const eslint = await createEslint(sandbox.path);
    const outside = (await eslint.calculateConfigForFile(join(sandbox.path, 'root.jsx'))) as EslintConfiguration;
    const inside = (await eslint.calculateConfigForFile(join(sandbox.path, 'app/client.jsx'))) as EslintConfiguration;
    expect(outside.rules['react/jsx-key']).toBeUndefined();
    expect(inside.rules['react/jsx-key']![0]).toBe(2);
    expect(outside.rules['import-x/exports-last']).toBeUndefined();
    expect(inside.rules['import-x/exports-last']).toBeUndefined();
    const source = 'export const query = sql`select 1`;';
    await createFileTree(sandbox.path, { 'app/client.jsx': source, 'root.jsx': source });
    expect(await listLintFindings(eslint, sandbox.path, ['app/client.jsx'], ['no-restricted-syntax'])).toStrictEqual(
        level === 'all' ? [{ file: 'app/client.jsx', rule: 'no-restricted-syntax', line: 1 }] : [],
    );
    expect(await listLintFindings(eslint, sandbox.path, ['root.jsx'], ['no-restricted-syntax'])).toStrictEqual([]);
});
test('level all keeps every rule that recommended turns on for a React file', async () => {
    const rules: Record<string, EslintConfiguration['rules']> = {};
    for (const level of LEVELS) {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['react'], { level }),
            'package.json': '{"private":true,"type":"module"}',
            'client.jsx': '',
        });
        const eslint = await createEslint(sandbox.path);
        const config = (await eslint.calculateConfigForFile('client.jsx')) as EslintConfiguration;
        rules[level] = config.rules;
    }
    const active = Object.entries(rules['recommended']!).filter(([, value]) => Array.isArray(value) && value[0] !== 0);
    expect(active.map(([name]) => name)).toContain('react/jsx-key');
    for (const [name] of active) expect((rules['all']![name] as unknown[])[0], name).not.toBe(0);
});
test('all applies your rule options except in script and test files', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], { level: 'all', tables: LEVEL_RULE_OPTIONS }),
        'package.json': '{"private":true,"type":"module"}',
        'source.js': '',
        'scripts/run.js': '',
        'tests/example.test.js': '',
    });

    const eslint = await createEslint(sandbox.path);
    const source = (await eslint.calculateConfigForFile('source.js')) as EslintConfiguration;
    const script = (await eslint.calculateConfigForFile('scripts/run.js')) as EslintConfiguration;
    const test = (await eslint.calculateConfigForFile('tests/example.test.js')) as EslintConfiguration;
    expect(source.rules['n/no-process-exit']![0]).toBe(2);
    expect(script.rules['n/no-process-exit']![0]).toBe(0);
    expect(test.rules['jsdoc/require-description']![0]).toBe(0);
    expect(source.rules['gspot/no-trivial-functions']).toStrictEqual([2, { trivialFunctionStatements: 4 }]);
});

test('recommended refuses options for a rule of level all, a rule that runs at no level, and a rule of no loaded plugin', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], { level: 'recommended', tables: UNAPPLIED_RULE_OPTIONS }),
        'package.json': '{"private":true,"type":"module"}',
        'source.js': '',
    });
    const refused = await runGspot(sandbox.path, ['apply']);
    expect(refused.code).toBe(2);
    expect(refused.stderr).toBe(`${UNAPPLIED_RULE_REFUSALS.join('\n')}\n`);
});

test.each([...LEVELS])(
    'layout rules stay off and empty-object fallbacks are reported only at level all (%s)',
    async (level) => {
        await using sandbox = await testdir();
        const settings = buildSandboxSettings(['javascript'], { level });
        await createFileTree(sandbox.path, {
            'gspot.toml': settings,
            'package.json': '{"private":true,"type":"module"}',
            'source.js': COALESCING_SOURCE,
        });
        const eslint = await createEslint(sandbox.path);
        async function lintFiles() {
            const config = (await eslint.calculateConfigForFile('source.js')) as EslintConfiguration;
            const layout = ['padding-line-between-statements', 'lines-between-class-members'].filter(
                (name) => config.rules[name]?.[0] !== undefined && config.rules[name][0] !== 0,
            );
            return {
                layout,
                findings: await listLintFindings(eslint, sandbox.path, ['source.js'], ['no-restricted-syntax']),
            };
        }
        const result = await lintFiles();
        expect(result).toStrictEqual({
            layout: [],
            findings:
                level === 'all'
                    ? [
                          { file: 'source.js', rule: 'no-restricted-syntax', line: 2 },
                          { file: 'source.js', rule: 'no-restricted-syntax', line: 3 },
                      ]
                    : [],
        });
        await writeFile(join(sandbox.path, 'source.js'), COALESCING_CORRECTED);
        const corrected = await lintFiles();
        expect(corrected).toStrictEqual({ layout: [], findings: [] });
    },
);
test('switching the level and back writes the same files', async () => {
    await using sandbox = await testdir();
    await writeFile(join(sandbox.path, 'source.js'), 'export const value = 1;\n');
    const outputs: { path: string; content: string }[][] = [];
    for (const level of ['recommended', 'all', 'recommended'] as const) {
        const settings = buildSandboxSettings(['javascript'], { rules: true, level });
        await writeFile(join(sandbox.path, 'gspot.toml'), settings);
        const session = await openSession(sandbox.path);
        const output = generate(session);
        using writer = openWriter(sandbox.path);
        await writeGeneratedFiles(session, output, writer);
        outputs.push(output.files.map(({ path, content }) => ({ path, content })));
    }
    expect(outputs[1]).not.toStrictEqual(outputs[0]);
    expect(outputs[2]).toStrictEqual(outputs[0]);
});

test.each([...LEVELS])(
    '%s asks for a blank line between a description and its tags only at level all',
    async (level) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['javascript'], { level }),
            'package.json': '{"private":true,"type":"module"}',
            'total.js': DOCUMENTED_PRICE_SOURCE,
        });

        const eslint = await createEslint(sandbox.path, { fix: true });
        const [result] = await eslint.lintFiles(['total.js']);
        expect(result?.output?.split('\n').slice(0, 3)).toStrictEqual(
            level === 'all' ? ['/**', ' * Add the two prices.', ' *'] : undefined,
        );
    },
);

test('your options for a rule that a configuration adds, such as @typescript-eslint/no-floating-promises, reach the ESLint file at level all', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript', 'typescript'], {
            level: 'all',
            tables: CONFIGURATION_RULE_OPTIONS.tables,
        }),
        ...CONFIGURATION_RULE_OPTIONS.files,
    });
    const eslint = await createEslint(sandbox.path);
    const configuration = (await eslint.calculateConfigForFile('source.ts')) as EslintConfiguration;
    expect(configuration.rules['@typescript-eslint/no-floating-promises']).toStrictEqual([2, { ignoreVoid: true }]);
    expect(
        await listLintFindings(eslint, sandbox.path, ['source.ts'], ['@typescript-eslint/no-floating-promises']),
    ).toStrictEqual([{ file: 'source.ts', rule: '@typescript-eslint/no-floating-promises', line: 2 }]);
});
