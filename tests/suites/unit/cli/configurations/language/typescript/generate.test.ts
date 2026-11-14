import { testdir } from 'testdirs';
import type { ESLint } from 'eslint';
import { test, expect } from 'bun:test';
import { join, relative } from 'node:path';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { toolModules } from '#tests/setup/sandboxes/node-modules.ts';
import { buildEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';
import { TYPED_RULE_PROJECTS } from '#tests/config/configurations/javascript/blocks.ts';

// typescript-estree keeps the first project service of a process, and unit files share a process, so ESLint runs alone.
test('a config file outside every tsconfig gets the typed rules, and one that a tsconfig includes stays there', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript']),
        'package.json': '{"private":true,"type":"module"}',
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["src/**/*.ts","vitest.config.ts"]}',
        'src/value.ts': 'export const value = 1;\n',
        'vite.config.ts': 'export const port = Number("3000") as number;\n',
        'vitest.config.ts': 'export const timeout = Number("3000") as number;\n',
        'scripts/deploy.ts': 'export const target = String("production") as string;\n',
    });
    await buildEslint(sandbox.path);
    const linted = await runCommand(
        [
            join(toolModules, '.bin/eslint'),
            '--format',
            'json',
            'vite.config.ts',
            'vitest.config.ts',
            'scripts/deploy.ts',
        ],
        { cwd: sandbox.path },
    );
    const results = JSON.parse(linted.stdout) as ESLint.LintResult[];
    expect(results.flatMap(({ messages }) => messages.filter(({ fatal }) => fatal === true))).toStrictEqual([]);
    expect(results.flatMap(({ messages }) => messages.map(({ message }) => message))).not.toContainEqual(
        expect.stringContaining('strictNullChecks'),
    );
    const typed = '@typescript-eslint/no-unnecessary-type-assertion';
    expect(
        results.flatMap(({ filePath, messages }) =>
            messages
                .filter(({ ruleId }) => ruleId === typed)
                .map(({ line }) => ({ file: convertToPosixPath(relative(sandbox.path, filePath)), line })),
        ),
    ).toStrictEqual([
        { file: 'scripts/deploy.ts', line: 1 },
        { file: 'vite.config.ts', line: 1 },
        { file: 'vitest.config.ts', line: 1 },
    ]);
});

test.each([...TYPED_RULE_PROJECTS])('$name gets typed lint rules', async ({ configurations, tables, files, file }) => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([...configurations], { level: 'all', tables }),
        ...files,
    });

    const eslint = await buildEslint(sandbox.path);
    const rules = ['@typescript-eslint/no-unnecessary-type-assertion'];
    expect(await listLintFindings(eslint, sandbox.path, [file], rules)).toStrictEqual([
        { file, rule: '@typescript-eslint/no-unnecessary-type-assertion', line: 4 },
    ]);
});

test('a default import with an inline type merges with a type-only import into code that parses', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript']),
        'package.json': '{"private":true,"type":"module"}\n',
        'tsconfig.json': '{"compilerOptions":{"strict":true,"noEmit":true},"include":["client.ts"]}\n',
        'client.ts': '',
    });

    const eslint = await buildEslint(sandbox.path, { fix: ({ ruleId }) => ruleId === 'import-x/no-duplicates' });
    const source =
        "import type { Level } from 'hls.js';\nimport Hls, { Events, type Config } from 'hls.js';\nexport { Hls, Events, type Config, type Level };\n";
    const [result] = await eslint.lintText(source, { filePath: 'client.ts' });
    const merged =
        "import Hls, { type Level , Events, type Config } from 'hls.js';\nexport { Hls, Events, type Config, type Level };\n";
    expect(result?.output).toBe(merged);
});

test('nine root config files outside every tsconfig still lint', async () => {
    const files = Array.from({ length: 9 }, (_, index) => `tool${String(index)}.config.ts`);
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript']),
        'package.json': '{"private":true,"type":"module"}',
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["src/**/*.ts"]}',
        'src/value.ts': 'export const value = 1;\n',
        ...Object.fromEntries(files.map((file) => [file, 'export const port = 3000;\n'])),
    });
    await buildEslint(sandbox.path);
    const linted = await runCommand([join(toolModules, '.bin/eslint'), '--format', 'json', ...files], {
        cwd: sandbox.path,
    });
    const results = JSON.parse(linted.stdout) as ESLint.LintResult[];
    expect(results).toHaveLength(files.length);
    expect(results.flatMap(({ messages }) => messages.filter(({ fatal }) => fatal === true))).toStrictEqual([]);
});
