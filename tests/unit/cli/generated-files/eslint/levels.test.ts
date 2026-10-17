import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { openWriter } from '#cli/ownership/writer.ts';
import { LEVELS } from '#cli/config/configurations.ts';
import { generate } from '#cli/generation/generate.ts';
import { writeGeneratedFiles } from '#cli/apply/write.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import type { EslintConfiguration } from '#tests/types/tool-output.ts';
import { createEslint, collectLintFindings } from '#tests/setup/tool-files.ts';
import { COALESCING_FIXED, COALESCING_SOURCE } from '#tests/data/generated-files/eslint/levels.ts';

test.each([...LEVELS])('%s keeps framework rules and syntax selectors inside their scope', async (level) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['javascript'], {
            tables: '[[scope]]\npath = "app"\nconfigurations = [ "react", "drizzle" ]\n',
            level: level,
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
    const raw = 'export const query = sql`select 1`;';
    await createFileTree(sandbox.path, { 'app/client.jsx': raw, 'root.jsx': raw });
    expect(await collectLintFindings(eslint, sandbox.path, ['app/client.jsx'], ['no-restricted-syntax'])).toStrictEqual(
        level === 'all' ? [{ file: 'app/client.jsx', rule: 'no-restricted-syntax', line: 1 }] : [],
    );
    expect(await collectLintFindings(eslint, sandbox.path, ['root.jsx'], ['no-restricted-syntax'])).toStrictEqual([]);
});
test('level all keeps every rule that recommended turns on for a React file', async () => {
    const rules = Object.fromEntries(
        await Promise.all(
            LEVELS.map(async (level) => {
                await using sandbox = await testdir();
                await createFileTree(sandbox.path, {
                    'gspot.toml': buildSettingsText(['react'], { level: level }),
                    'package.json': '{"private":true,"type":"module"}',
                    'client.jsx': '',
                });
                const eslint = await createEslint(sandbox.path);
                const config = (await eslint.calculateConfigForFile('client.jsx')) as EslintConfiguration;
                return [level, config.rules] as const;
            }),
        ),
    );
    const active = Object.entries(rules['recommended']!).filter(([, value]) => Array.isArray(value) && value[0] !== 0);
    expect(active.map(([name]) => name)).toContain('react/jsx-key');
    for (const [name] of active) expect((rules['all']![name] as unknown[])[0], name).not.toBe(0);
});
test.each([...LEVELS])('%s applies your rule options except in script and test files', async (level) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['javascript'], {
            level,
            tables: '[tools.eslint.rules]\n"n/no-process-exit" = []\n"jsdoc/require-description" = []\n"gspot/no-trivial-functions" = [{trivialStatements = 4}]\n',
        }),
        'package.json': '{"private":true,"type":"module"}',
        'source.js': '',
        'scripts/run.js': '',
        'tests/example.test.js': '',
    });
    const eslint = await createEslint(sandbox.path);
    const source = (await eslint.calculateConfigForFile('source.js')) as EslintConfiguration;
    const script = (await eslint.calculateConfigForFile('scripts/run.js')) as EslintConfiguration;
    const test = (await eslint.calculateConfigForFile('tests/example.test.js')) as EslintConfiguration;
    expect(source.rules['n/no-process-exit']![0]).toBe(level === 'all' ? 2 : 0);
    expect(script.rules['n/no-process-exit']![0]).toBe(0);
    expect(test.rules['jsdoc/require-description']![0]).toBe(0);
    expect(source.rules['gspot/no-trivial-functions']![0]).toBe(level === 'all' ? 2 : 0);
    if (level === 'all')
        expect(source.rules['gspot/no-trivial-functions']).toStrictEqual([2, { trivialStatements: 4 }]);
});
test.each([...LEVELS])(
    'layout rules stay off and empty-object fallbacks are reported only at level all (%s)',
    async (level) => {
        await using sandbox = await testdir();
        const settings = buildSettingsText(['javascript'], { level });
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
                findings: await collectLintFindings(eslint, sandbox.path, ['source.js'], ['no-restricted-syntax']),
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
        await Bun.write(join(sandbox.path, 'source.js'), COALESCING_FIXED);
        const corrected = await lintFiles();
        expect(corrected).toStrictEqual({ layout: [], findings: [] });
    },
);
test('switching the level and back writes the same files and the AGENTS.md level', async () => {
    await using sandbox = await testdir();
    await Bun.write(join(sandbox.path, 'source.js'), 'export const value = 1;\n');
    const outputs: string[] = [];
    for (const level of ['recommended', 'all', 'recommended'] as const) {
        const settings = buildSettingsText(['javascript'], { rules: true, level: level });
        await Bun.write(join(sandbox.path, 'gspot.toml'), settings);
        const session = await openSession(sandbox.path);
        const output = generate(session);
        const config = output.files.find((file) => file.path.endsWith('/eslint.config.mjs'))!;
        using log = openWriter(sandbox.path);
        writeGeneratedFiles(session, output, log);
        const block = output.blocks.find((block) => block.path === 'AGENTS.md')!.block;
        expect(block).toContain(`Level: \`${level}\``);
        outputs.push(config.content);
    }
    expect(outputs[0]).not.toBe(outputs[1]);
    expect(outputs[2]).toBe(outputs[0]);
});
