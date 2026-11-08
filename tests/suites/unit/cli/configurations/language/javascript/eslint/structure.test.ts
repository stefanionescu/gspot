import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import type { ESLint } from 'eslint';
import { createFileTree, testdir } from 'testdirs';

import { compareText } from '#cli/system/text.ts';
import { INDEX_ONLY_REEXPORTS } from '#tests/config/configurations/javascript/configuration-blocks.ts';
import {
    BARREL_CASES,
    ENTRYPOINT_SOURCE,
    ENTRYPOINT_TABLES,
    IMPORT_CASES,
    IMPORT_FILES,
    LEVEL_REEXPORT_CASES,
    REEXPORT_CASES,
    STARTER_SOURCE,
    TRIVIAL_ENTRYPOINT_FILES,
    TRIVIAL_RULES,
} from '#tests/config/configurations/javascript/plugins.ts';
import { LINGUIST_GENERATED_PATTERN } from '#tests/config/setup/programs.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';
import type { SourceRuleCase } from '#tests/types/configurations.ts';
import type { LintFinding } from '#tests/types/setup.ts';

async function listTrivialFindings(root: string, settings: string): Promise<Array<Pick<LintFinding, 'file' | 'rule'>>> {
    await writeFile(join(root, 'gspot.toml'), settings);
    const eslint = await buildEslint(root);
    const findings = await listLintFindings(eslint, root, ['src', 'api/src'], TRIVIAL_RULES);
    return findings.map(({ file, rule }) => ({ file, rule }));
}

function listTrivialFiles(findings: Array<Pick<LintFinding, 'file' | 'rule'>>): string[] {
    const files = findings.filter(({ rule }) => rule === 'gspot/no-trivial-files').map(({ file }) => file);
    return [...new Set(files)].toSorted(compareText);
}

async function assertSourceRules(
    eslint: ESLint,
    root: string,
    files: readonly string[],
    cases: readonly SourceRuleCase[],
): Promise<void> {
    for (const file of files) {
        for (const { name, source, rule, count } of cases) {
            await createFileTree(root, { [file]: source });
            const findings = await listLintFindings(eslint, root, [file], [rule]);
            expect(findings, name).toStrictEqual(Array.from({ length: count }, () => ({ file, rule, line: 1 })));
        }
    }
}

test.each(['all'] as const)(
    'Knip entry files still get the trivial-file rules at %s, in nested scopes',
    async (level) => {
        await using sandbox = await testdir({
            'package.json': '{"name":"entry-sandbox","private":true,"type":"module"}',
            'src/start.js': STARTER_SOURCE,
            'src/main.js': ENTRYPOINT_SOURCE,
            'src/task.js': ENTRYPOINT_SOURCE,
            'api/src/start.js': STARTER_SOURCE,
            'api/src/main.js': ENTRYPOINT_SOURCE,
            'api/src/task.js': ENTRYPOINT_SOURCE,
        });

        const settings = buildSandboxSettings(['javascript'], { level, tables: ENTRYPOINT_TABLES });
        expect(listTrivialFiles(await listTrivialFindings(sandbox.path, settings))).toStrictEqual([
            ...TRIVIAL_ENTRYPOINT_FILES,
        ]);
        await writeFile(
            join(sandbox.path, 'src/main.js'),
            "import { start } from './start.js';\nfunction boot() { start(); }\nboot();\n",
        );
        const mainFindings = [{ file: 'src/main.js', rule: 'gspot/no-trivial-functions' }];
        const findings = await listTrivialFindings(sandbox.path, settings);
        expect(findings.filter(({ file }) => file === 'src/main.js')).toStrictEqual(mainFindings);
        expect(listTrivialFiles(findings)).toStrictEqual(
            TRIVIAL_ENTRYPOINT_FILES.filter((file) => file !== 'src/main.js'),
        );
        await writeFile(
            join(sandbox.path, 'src/main.js'),
            "import { start } from './start.js';\nexport function boot() { start(); }\n",
        );
        const publicFindings = await listTrivialFindings(sandbox.path, settings);
        expect(publicFindings.filter(({ file }) => file === 'src/main.js')).toStrictEqual([]);
    },
);

test('level all skips build output and files marked linguist-generated in .gitattributes', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            level: 'all',
        }),
        'package.json': '{"private":true,"type":"module"}\n',
        'tests/build/check.js': 'missing();',
        'emitted/check.js': 'missing();',
        '.gitattributes': LINGUIST_GENERATED_PATTERN,
    });

    const eslint = await buildEslint(sandbox.path);
    for (const filePath of ['tests/build/check.js', 'emitted/check.js']) {
        expect(await eslint.isPathIgnored(filePath)).toBe(true);
    }
});

test('a JSON import attribute is accepted where your import extensions need a suffix', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            level: 'all',
            tables: '[javascript]\nimport_extension = "js"\n\n',
            scopes: [{ path: 'app', configurations: ['javascript'] }],
        }),
        'package.json': '{"private":true,"type":"module","imports":{"#data/*":"./*.json"}}\n',
        'main.js': '',
        'app/main.js': '',
    });

    const eslint = await buildEslint(sandbox.path);
    for (const filePath of ['main.js', 'app/main.js']) {
        await createFileTree(sandbox.path, { [filePath]: 'import manifest from "#data/package";' });
        expect(await listLintFindings(eslint, sandbox.path, [filePath], ['gspot/restricted-syntax'])).toStrictEqual([
            { file: filePath, rule: 'gspot/restricted-syntax', line: 1 },
        ]);
        await createFileTree(sandbox.path, {
            [filePath]: 'import manifest from "#data/package" with { type: "json" };',
        });
        expect(await listLintFindings(eslint, sandbox.path, [filePath], ['gspot/restricted-syntax'])).toStrictEqual([]);
    }
});

test('at level basic, the import rules apply in root and child scopes', async () => {
    await using sandbox = await testdir({
        ...IMPORT_FILES,
        'gspot.toml': buildSandboxSettings(['typescript'], {
            level: 'basic',
            tables: '[[scope]]\npath = "app"\nconfigurations = ["typescript"]\n',
        }),
    });
    const eslint = await buildEslint(sandbox.path);
    await assertSourceRules(
        eslint,
        sandbox.path,
        ['src/source.ts', 'app/src/source.ts'],
        IMPORT_CASES.map(([name, source, rule, count]) => ({ name, source, rule, count })),
    );
});

test.each([...LEVEL_REEXPORT_CASES])(
    'at %s with reexports = %s, the re-exports and index limits apply in root and child scopes',
    async (level, reexports) => {
        await using sandbox = await testdir({
            ...IMPORT_FILES,
            'gspot.toml': buildSandboxSettings(['typescript'], {
                level,
                tables: `[structure]\nreexports = ${reexports === 'index-only' ? INDEX_ONLY_REEXPORTS : '"none"'}\n[limits]\nmax_index_exports = 2\n[[scope]]\npath = "app"\nconfigurations = ["typescript"]\n`,
            }),
        });
        const eslint = await buildEslint(sandbox.path);
        for (const file of ['src/source.ts', 'src/index.ts', 'app/src/source.ts', 'app/src/index.ts']) {
            const isBanned = level === 'all' && (reexports === 'none' || !file.endsWith('/index.ts'));
            await assertSourceRules(
                eslint,
                sandbox.path,
                [file],
                REEXPORT_CASES.map(([source, count]) => ({
                    source,
                    rule: 'gspot/no-trivial-files',
                    count: isBanned ? count : 0,
                })),
            );
        }
        if (level === 'all' && reexports === 'index-only')
            await assertSourceRules(
                eslint,
                sandbox.path,
                ['src/index.ts', 'app/src/index.ts'],
                BARREL_CASES.map(([name, source, count]) => ({ name, source, rule: 'gspot/no-trivial-files', count })),
            );
    },
);
