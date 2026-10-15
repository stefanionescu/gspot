import { ESLint } from 'eslint';
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { runCommand } from '#tests/setup/processes.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { SORT_CASES, SORT_RULES, SORT_LEVELS } from '#tests/config/eslint/sorting.ts';
import { createEslint, lintFindings, readEslintConfiguration } from '#tests/setup/generate.ts';

test('the generated import gap rule counts comments', async () => {
    await using sandbox = await testdir({
        'gspot.toml': settingsText(['javascript'], { level: 'all' }),
        'source.js': 'export const value = 1;\n',
    });
    const eslint = await createEslint(sandbox.path);
    const config = await readEslintConfiguration(eslint, join(sandbox.path, 'source.js'));
    expect(config.rules['import-x/newline-after-import']?.[1]).toStrictEqual({ count: 1, considerComments: true });
});

test('a bundler scope uses extensionless imports while the Node.js parent keeps .js suffixes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `configurations = ["javascript"]\n[[scope]]\npath = "app"\nconfigurations = ["react"]\n`,
        'source.js': '',
        'value.js': 'export const value = 1;\n',
        'app/source.js': '',
        'app/value.js': 'export const value = 1;\n',
    });
    const eslint = await createEslint(sandbox.path);
    const source = 'import { value } from "./value";\n';
    await createFileTree(sandbox.path, { 'source.js': source, 'app/source.js': source });
    const rules = ['n/file-extension-in-import'];
    expect(await lintFindings(eslint, sandbox.path, ['source.js'], rules)).toStrictEqual([
        { file: 'source.js', rule: 'n/file-extension-in-import', line: 1 },
    ]);
    expect(await lintFindings(eslint, sandbox.path, ['app/source.js'], rules)).toStrictEqual([]);
});

test('ESLint fixes useless path segments and the fixed Node ESM imports still run', async () => {
    const level = 'all';
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['javascript'], { level }),
        'package.json': '{"private":true,"type":"module"}',
        'lib/index.js': 'export const value = 42;\n',
        'source.js': "import { value } from './lib/index.js';\nexport const result = value;\n",
        'redundant.js': "import { value } from './lib/../lib/index.js';\nexport const result = value;\n",
    });
    const eslint = await createEslint(sandbox.path);
    const files = ['source.js', 'redundant.js'];
    const rule = 'import-x/no-useless-path-segments';
    const rules = [rule];
    expect(await lintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([
        { file: 'redundant.js', rule: 'import-x/no-useless-path-segments', line: 1 },
    ]);
    const [result] = await eslint.lintFiles(['redundant.js']);
    expect(result!.messages.find(({ ruleId }) => ruleId === rule)).toMatchObject({
        severity: 2,
        fix: { text: '"./lib/index.js"' },
    });
    const fixing = await createEslint(sandbox.path, { fix: true });
    await ESLint.outputFixes(await fixing.lintFiles(['source.js', 'redundant.js']));
    expect(await lintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([]);
    for (const path of ['source.js', 'redundant.js']) {
        expect(await Bun.file(join(sandbox.path, path)).text()).toContain('./lib/index.js');
        const runtime = await runCommand(
            [
                'node',
                '--input-type=module',
                '-e',
                `import assert from 'node:assert/strict'; import { result } from './${path}'; assert.equal(result, 42);`,
            ],
            { cwd: sandbox.path },
        );
        expect(runtime.code, runtime.stdout + runtime.stderr).toBe(0);
    }
});

test.each([...SORT_LEVELS])(
    'imports and exports are sorted at level all only, in root and child scopes ($level)',
    async ({ level, severity }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText(['typescript'], {
                level,
                tables: '[[scope]]\npath = "app"\nconfigurations = [ "typescript" ]\n',
            }),
            'package.json': '{"private":true,"type":"module"}',
            'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["src/**/*.ts"]}',
            'app/tsconfig.json': '{"compilerOptions":{"strict":true},"include":["src/**/*.ts"]}',
            'src/source.ts': '',
            'app/src/source.ts': '',
        });
        const eslint = await createEslint(sandbox.path, {
            fix: ({ ruleId }) =>
                (ruleId !== null && new Set<string>(SORT_RULES).has(ruleId)) || ruleId === 'gspot/header-first',
        });
        for (const prefix of ['', 'app/']) {
            const filePath = `${prefix}src/source.ts`;
            const config = await readEslintConfiguration(eslint, filePath);
            expect(SORT_RULES.map((rule) => config.rules[rule]?.[0] ?? 0)).toStrictEqual(
                SORT_RULES.map(() => severity),
            );
            for (const { source, fixed } of SORT_CASES) {
                const [result] = await eslint.lintText(source, { filePath });
                expect(result?.fatalErrorCount).toBe(0);
                expect(result?.output ?? source).toBe(level === 'all' ? fixed : source);
                expect(
                    result!.messages.find(({ ruleId }) => ruleId !== null && new Set<string>(SORT_RULES).has(ruleId)),
                ).toBeUndefined();
            }
        }
    },
);
