import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import type { ESLint } from 'eslint';
import { testdir } from 'testdirs';

import { compareText } from '#cli/system/text.ts';
import {
    TYPE_EXPORT_FILES,
    TYPED_RULE_PROJECTS,
} from '#tests/config/configurations/javascript/configuration-blocks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildEslint, listFindingRules, listLintFindings } from '#tests/setup/eslint/lint.ts';
import { toolModules } from '#tests/setup/sandboxes/node-modules.ts';
import { runCommand } from '#tests/setup/system/processes.ts';

// typescript-estree keeps the first project service of a process, and unit files share a process, so ESLint runs alone.
test('a config file outside every tsconfig gets the typed rules, and one that a tsconfig includes stays there', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript']),
        'package.json': '{"private":true,"type":"module"}',
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["src/**/*.ts","vitest.config.ts"]}',
        'src/value.ts': 'export const value = 1;\n',
        'vite.config.ts': 'export const port = 3000;\n',
        'vitest.config.ts': 'export const timeout = 3000;\n',
        'scripts/deploy.ts': 'export const target = "production";\n',
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
    const source = await readFile(join(sandbox.path, file), 'utf8');
    await writeFile(join(sandbox.path, file), source.replace(' as number', ''));
    expect(await listLintFindings(eslint, sandbox.path, [file], rules)).toStrictEqual([]);
});

test.each(['all'] as const)('%s type import and export rules apply at their declared level', async (level) => {
    await using sandbox = await testdir({
        ...TYPE_EXPORT_FILES,
        'gspot.toml': buildSandboxSettings(['typescript'], {
            level,
            tables: '[structure]\nreexports = { value = "index-only", reason = "The package exports its public index files." }\n',
        }),
    });

    const eslint = await buildEslint(sandbox.path);
    const rules = ['@typescript-eslint/consistent-type-imports', '@typescript-eslint/consistent-type-exports'];
    const findings = await listLintFindings(eslint, sandbox.path, ['index.ts'], rules);
    expect(listFindingRules(findings)).toStrictEqual(rules.toSorted(compareText));
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
    expect(result?.fatalErrorCount).toBe(0);
    const merged =
        "import Hls, { type Level , Events, type Config } from 'hls.js';\nexport { Hls, Events, type Config, type Level };\n";
    expect(result?.output).toBe(merged);
    const [again] = await eslint.lintText(merged, { filePath: 'client.ts' });
    expect(again?.fatalErrorCount).toBe(0);
});

test('gspot/no-magic-numbers accepts the numbers of a module-level const and reports the others', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}\n',
        'tsconfig.json': '{"compilerOptions":{"strict":true,"noEmit":true},"include":["source.ts"]}\n',
        'source.ts':
            'export const SIZES = [16, 32, 64];\nexport const TIMEOUT_MS = 60 * 1000;\nexport function wait(): number {\n    return TIMEOUT_MS + 250;\n}\n',
    });

    const eslint = await buildEslint(sandbox.path);
    expect(
        await listLintFindings(
            eslint,
            sandbox.path,
            ['source.ts'],
            ['gspot/no-magic-numbers', '@typescript-eslint/no-magic-numbers'],
        ),
    ).toStrictEqual([{ file: 'source.ts', rule: 'gspot/no-magic-numbers', line: 4 }]);
});

test('declaration merging is accepted only in declaration files at level all', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}\n',
        'tsconfig.json': '{"compilerOptions":{"strict":true,"noEmit":true},"include":["*.ts"]}\n',
        'global.d.ts':
            'export {};\ndeclare global { interface RequestContext { accountId: string; } }\ndeclare global { interface RequestContext { requestId: string; } }\n',
        'context.ts': 'export interface RequestContext { accountId: string; }\n',
        'aliases.ts': 'export type RequestContext = { accountId: string; };\n',
    });

    const eslint = await buildEslint(sandbox.path);
    expect(
        await listLintFindings(
            eslint,
            sandbox.path,
            ['global.d.ts', 'context.ts', 'aliases.ts'],
            ['@typescript-eslint/consistent-type-definitions'],
        ),
    ).toStrictEqual([{ file: 'context.ts', rule: '@typescript-eslint/consistent-type-definitions', line: 1 }]);
});
