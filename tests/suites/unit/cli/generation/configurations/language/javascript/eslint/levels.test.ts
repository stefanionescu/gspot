import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/planning/session.ts';
import { openWriter } from '#cli/repository/writer.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { generateFiles } from '#cli/generation/generate.ts';
import { LEVELS } from '#cli/config/configurations/names.ts';
import { writeGeneratedFiles } from '#cli/generation/write.ts';
import type { EslintConfiguration } from '#tests/types/tools.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { createEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';

import {
    COALESCING_SOURCE,
    COALESCING_CORRECTED,
    DOCUMENTED_PRICE_SOURCE,
    CONFIGURATION_RULE_OPTIONS,
} from '#tests/config/generation/configurations/language/javascript/eslint/levels.ts';

test.each([...LEVELS])('%s keeps framework rules and syntax selectors inside their scope', async (level) => {
    await using sandbox = await createGitSandbox({
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
    expect(outside.rules['@eslint-react/no-missing-key']).toBeUndefined();
    expect(inside.rules['@eslint-react/no-missing-key']![0]).toBe(2);
    const source = 'export const query = sql`select 1`;';
    await createFileTree(sandbox.path, { 'app/client.jsx': source, 'root.jsx': source });
    expect(await listLintFindings(eslint, sandbox.path, ['app/client.jsx'], ['no-restricted-syntax'])).toStrictEqual(
        level === 'all' ? [{ file: 'app/client.jsx', rule: 'no-restricted-syntax', line: 1 }] : [],
    );
    expect(await listLintFindings(eslint, sandbox.path, ['root.jsx'], ['no-restricted-syntax'])).toStrictEqual([]);
});

test('level all keeps every rule that level basic turns on for a React file', async () => {
    const rules: Record<string, EslintConfiguration['rules']> = {};
    for (const level of LEVELS) {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['react'], { level }),
            'package.json': '{"private":true,"type":"module"}',
            'client.jsx': '',
        });
        const eslint = await createEslint(sandbox.path);
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
            tables: '[limits.javascript]\ntrivial_function_statements = 4\n[tools.eslint.rules]\n"n/no-process-exit" = []\n"jsdoc/require-description" = []\n',
        }),
        'package.json': '{"private":true,"type":"module"}',
        'source.js': '',
        'scripts/run.js': '',
        'tests/example.test.js': '',
    });

    const eslint = await createEslint(sandbox.path);
    const source = (await eslint.calculateConfigForFile('source.js')) as EslintConfiguration;
    const script = (await eslint.calculateConfigForFile('scripts/run.js')) as EslintConfiguration;
    const testFile = (await eslint.calculateConfigForFile('tests/example.test.js')) as EslintConfiguration;
    expect(source.rules['n/no-process-exit']![0]).toBe(2);
    expect(script.rules['n/no-process-exit']![0]).toBe(0);
    expect(testFile.rules['jsdoc/require-description']![0]).toBe(0);
    expect(source.rules['gspot/no-trivial-functions']).toStrictEqual([2, { trivialFunctionStatements: 4 }]);
});

test('level basic refuses options for a rule of level all, a rule that runs at no level, and a rule of no loaded plugin', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            level: 'basic',
            tables: '[tools.eslint.rules]\n"n/no-process-exit" = []\n"id-length" = []\n"acme/foo" = []\n',
        }),
        'package.json': '{"private":true,"type":"module"}',
        'source.js': '',
    });
    const refused = await runGspot(sandbox.path, ['apply']);
    expect(refused.code).toBe(2);
    expect(refused.stderr).toBe(
        `${[
            'n/no-process-exit runs only at level all. gspot sets options only for the rules that run at level basic.',
            'gspot runs id-length at no level, so it takes no options. For a rule of your own, add a [[tools.eslint.plugins]] record.',
            'gspot runs acme/foo at no level, so it takes no options. For a rule of your own, add a [[tools.eslint.plugins]] record.',
        ].join('\n')}\n`,
    );
});

test.each([...LEVELS])(
    'layout rules stay off and empty-object fallbacks are reported only at level all (%s)',
    async (level) => {
        await using sandbox = await createGitSandbox({});
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
    await using sandbox = await createGitSandbox({});
    await writeFile(join(sandbox.path, 'source.js'), 'export const value = 1;\n');
    const outputs: { path: string; content: string }[][] = [];
    for (const level of ['basic', 'all', 'basic'] as const) {
        const settings = buildSandboxSettings(['javascript'], { rules: true, level });
        await writeFile(join(sandbox.path, 'gspot.toml'), settings);
        const session = await openSession(sandbox.path);
        const output = generateFiles(session);
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
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['javascript'], { level }),
            'package.json': '{"private":true,"type":"module"}',
            'total.js': DOCUMENTED_PRICE_SOURCE,
        });

        const eslint = await createEslint(sandbox.path, { fix: true });
        const [result] = await eslint.lintFiles(['total.js']);
        expect(result?.output?.split('\n').slice(0, 3)).toStrictEqual(
            level === 'all' ? ['/**', 'Add the two prices.', ''] : undefined,
        );
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
    const eslint = await createEslint(sandbox.path);
    const configuration = (await eslint.calculateConfigForFile('source.ts')) as EslintConfiguration;
    expect(configuration.rules['@typescript-eslint/no-floating-promises']).toStrictEqual([2, { ignoreVoid: true }]);
    expect(
        await listLintFindings(eslint, sandbox.path, ['source.ts'], ['@typescript-eslint/no-floating-promises']),
    ).toStrictEqual([{ file: 'source.ts', rule: '@typescript-eslint/no-floating-promises', line: 2 }]);
});

test.each([...LEVELS])('%s keeps core bug checks and TypeScript recommended checks active', async (level) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript', 'typescript'], {
            level,
            tables: '[[tools.eslint.override]]\npaths = ["**/*.js", "**/*.ts"]\nruntime = "browser"\n',
        }),
        'package.json': '{"private":true,"type":"module"}',
        'source.js': '',
        'source.ts': '',
    });
    const eslint = await createEslint(sandbox.path);
    for (const file of ['source.js', 'source.ts']) {
        const config = (await eslint.calculateConfigForFile(file)) as EslintConfiguration;
        const rules = [
            'no-self-compare',
            file.endsWith('.js') ? 'no-implied-eval' : '@typescript-eslint/no-explicit-any',
        ];
        expect(Object.fromEntries(rules.map((name) => [name, config.rules[name]?.[0]]))).toStrictEqual(
            Object.fromEntries(rules.map((name) => [name, 2])),
        );
        expect(config.rules['unicorn/no-process-exit']?.[0]).toBe(level === 'all' ? 2 : 0);
    }
});
