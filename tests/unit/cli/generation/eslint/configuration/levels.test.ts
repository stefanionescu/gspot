import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { LEVELS } from '#cli/config/configurations.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { COALESCING_FIXED, COALESCING_SOURCE } from '#tests/config/eslint/levels.ts';
import { createEslint, lintFindings, readEslintConfiguration } from '#tests/setup/generate.ts';

test.each([...LEVELS])('%s keeps framework rules and syntax selectors inside their scope', async (level) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['javascript'], {
            tables: '[[scope]]\npath = "app"\nconfigurations = [ "react", "drizzle" ]\n',
            level: level,
        }),
        'package.json': '{"private":true,"type":"module"}',
        'root.jsx': '',
        'app/client.jsx': '',
    });
    const eslint = await createEslint(sandbox.path);
    const outside = await readEslintConfiguration(eslint, join(sandbox.path, 'root.jsx'));
    const inside = await readEslintConfiguration(eslint, join(sandbox.path, 'app/client.jsx'));
    expect(outside.rules['react/jsx-key']).toBeUndefined();
    expect(inside.rules['react/jsx-key']![0]).toBe(2);
    const raw = 'export const query = sql`select 1`;';
    await createFileTree(sandbox.path, { 'app/client.jsx': raw, 'root.jsx': raw });
    expect(await lintFindings(eslint, sandbox.path, ['app/client.jsx'], ['no-restricted-syntax'])).toStrictEqual(
        level === 'all' ? [{ file: 'app/client.jsx', rule: 'no-restricted-syntax', line: 1 }] : [],
    );
    expect(await lintFindings(eslint, sandbox.path, ['root.jsx'], ['no-restricted-syntax'])).toStrictEqual([]);
});

test('level all keeps every rule that recommended turns on for a React file', async () => {
    const rules: Record<string, Record<string, unknown>> = {};
    for (const level of LEVELS) {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText(['react'], { level: level }),
            'package.json': '{"private":true,"type":"module"}',
            'client.jsx': '',
        });
        const eslint = await createEslint(sandbox.path);
        const config = await readEslintConfiguration(eslint, 'client.jsx');
        rules[level] = config.rules!;
    }
    const active = Object.entries(rules['recommended']!).filter(([, value]) => Array.isArray(value) && value[0] !== 0);
    expect(active.map(([name]) => name)).toContain('react/jsx-key');
    for (const [name] of active) expect((rules['all']![name] as unknown[])[0], name).not.toBe(0);
});

test('level all reports TODO comments', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['javascript'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}',
        'source.js': '',
    });
    const eslint = await createEslint(sandbox.path);
    const rules = ['sonarjs/todo-tag', 'unicorn/expiring-todo-comments'];
    await createFileTree(sandbox.path, { 'source.js': '// TODO: finish the feature.\nexport const feature = 1;\n' });
    expect(await lintFindings(eslint, sandbox.path, ['source.js'], rules)).toStrictEqual([
        { file: 'source.js', rule: 'sonarjs/todo-tag', line: 1 },
        { file: 'source.js', rule: 'unicorn/expiring-todo-comments', line: 1 },
    ]);
    const [result] = await eslint.lintFiles(['source.js']);
    for (const rule of rules) expect(result!.messages.find(({ ruleId }) => ruleId === rule)?.severity).toBe(2);
    await createFileTree(sandbox.path, { 'source.js': '// The feature lists tasks.\nexport const feature = 1;\n' });
    expect(await lintFindings(eslint, sandbox.path, ['source.js'], rules)).toStrictEqual([]);
});

test.each([...LEVELS])('%s applies your rule options except in script and test files', async (level) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['javascript'], {
            level,
            tables: '[tools.eslint.rules]\n"n/no-process-exit" = []\n"jsdoc/require-description" = []\n"gspot/no-trivial-functions" = [{trivialStatements = 4}]\n',
        }),
        'package.json': '{"private":true,"type":"module"}',
        'source.js': '',
        'scripts/run.js': '',
        'tests/example.test.js': '',
    });
    const eslint = await createEslint(sandbox.path);
    const source = await readEslintConfiguration(eslint, 'source.js');
    const script = await readEslintConfiguration(eslint, 'scripts/run.js');
    const test = await readEslintConfiguration(eslint, 'tests/example.test.js');
    expect(source.rules['n/no-process-exit']![0]).toBe(level === 'all' ? 2 : 0);
    expect(script.rules['n/no-process-exit']![0]).toBe(0);
    expect(test.rules['jsdoc/require-description']![0]).toBe(0);
    if (level === 'recommended') expect(source.rules['gspot/no-trivial-functions']).toBeUndefined();
    else expect(source.rules['gspot/no-trivial-functions']![0]).toBe(2);
    if (level === 'all')
        expect(source.rules['gspot/no-trivial-functions']).toStrictEqual([2, { trivialStatements: 4 }]);
});

test.each([...LEVELS])(
    'layout rules stay off and empty-object fallbacks are reported only at level all (%s)',
    async (level) => {
        await using sandbox = await testdir();
        const settings = settingsText(['javascript'], { level });
        await createFileTree(sandbox.path, {
            'gspot.toml': settings,
            'package.json': '{"private":true,"type":"module"}',
            'source.js': COALESCING_SOURCE,
        });
        const eslint = await createEslint(sandbox.path);
        async function lintReport() {
            const config = await readEslintConfiguration(eslint, 'source.js');
            const layout = ['padding-line-between-statements', 'lines-between-class-members'].filter(
                (name) => config.rules[name]?.[0] !== undefined && config.rules[name][0] !== 0,
            );
            return {
                layout,
                findings: await lintFindings(eslint, sandbox.path, ['source.js'], ['no-restricted-syntax']),
            };
        }
        const result = await lintReport();
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
        await Bun.write(join(sandbox.path, 'source.js'), COALESCING_FIXED);
        const corrected = await lintReport();
        expect(corrected).toStrictEqual({ layout: [], findings: [] });
    },
);
