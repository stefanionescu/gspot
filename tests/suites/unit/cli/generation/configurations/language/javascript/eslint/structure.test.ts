import { join } from 'node:path';
import type { ESLint } from 'eslint';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { LEVELS } from '#cli/config/configurations/names.ts';
import { LINGUIST_GENERATED_PATTERN } from '#tests/config/git.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createEslint, listFindingRules, listLintFindings } from '#tests/setup/eslint/lint.ts';
import { type LintFinding, type SourceRuleCase, type EslintConfiguration } from '#tests/types/tools.ts';
import { INDEX_ONLY_REEXPORTS } from '#tests/config/generation/configurations/language/javascript/eslint/settings.ts';

import {
    BARREL_CASES,
    IMPORT_CASES,
    IMPORT_FILES,
    TRIVIAL_RULES,
    STARTER_SOURCE,
    REEXPORT_CASES,
    ENTRYPOINT_TABLES,
    ENTRYPOINT_SOURCE,
    LEVEL_REEXPORT_CASES,
    TRIVIAL_ENTRYPOINT_FILES,
} from '#tests/config/generation/configurations/language/javascript/eslint/structure.ts';

async function listTrivialFindings(root: string, settings: string): Promise<Pick<LintFinding, 'file' | 'rule'>[]> {
    await writeFile(join(root, 'gspot.toml'), settings);
    const eslint = await createEslint(root);
    const findings = await listLintFindings(eslint, root, ['src', 'api/src'], TRIVIAL_RULES);
    return findings.map(({ file, rule }) => ({ file, rule }));
}

function listTrivialFiles(findings: Pick<LintFinding, 'file' | 'rule'>[]): string[] {
    const files = findings.filter(({ rule }) => rule === 'gspot/no-trivial-files').map(({ file }) => file);
    return [...new Set(files)].toSorted((left, right) => left.localeCompare(right));
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

test.each([...LEVELS])('Knip entry files still get the trivial-file rules at %s, in nested scopes', async (level) => {
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
    expect(listTrivialFiles(await listTrivialFindings(sandbox.path, settings))).toStrictEqual(
        level === 'all' ? [...TRIVIAL_ENTRYPOINT_FILES] : [],
    );
    await writeFile(
        join(sandbox.path, 'src/main.js'),
        "import { start } from './start.js';\nfunction boot() { start(); }\nboot();\n",
    );
    const mainFindings = level === 'all' ? [{ file: 'src/main.js', rule: 'gspot/no-trivial-functions' }] : [];
    const findings = await listTrivialFindings(sandbox.path, settings);
    expect(findings.filter(({ file }) => file === 'src/main.js')).toStrictEqual(mainFindings);
    expect(listTrivialFiles(findings)).toStrictEqual(
        level === 'all' ? TRIVIAL_ENTRYPOINT_FILES.filter((file) => file !== 'src/main.js') : [],
    );
    await writeFile(
        join(sandbox.path, 'src/main.js'),
        "import { start } from './start.js';\nexport function boot() { start(); }\n",
    );
    const publicFindings = await listTrivialFindings(sandbox.path, settings);
    expect(publicFindings.filter(({ file }) => file === 'src/main.js')).toStrictEqual(mainFindings);
});

test('level all skips build output and files marked linguist-generated in .gitattributes', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            level: 'all',
        }),
        'package.json': '{"private":true,"type":"module"}\n',
        'tests/build/check.js': 'missing();',
        'src/dist/check.js': 'missing();',
        'coverage/check.js': 'missing();',
        'emitted/check.js': 'missing();',
        '.gitattributes': LINGUIST_GENERATED_PATTERN,
    });

    const eslint = await createEslint(sandbox.path);
    for (const filePath of ['tests/build/check.js', 'src/dist/check.js', 'coverage/check.js', 'emitted/check.js']) {
        expect(await eslint.isPathIgnored(filePath)).toBe(true);
    }
});

test.each([...LEVELS])('size limits apply to test files only at level all (%s)', async (level) => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            tables: '[limits]\nfile_lines = 8\nfunction_lines = 5\nfunction_statements = 3\n',
            level,
        }),
        'package.json': '{"private":true,"type":"module"}\n',
        'sample.test.js': '',
    });

    const eslint = await createEslint(sandbox.path);
    const rules = ['max-lines', 'max-lines-per-function', 'max-statements'];
    const declarations = Array.from(
        { length: 9 },
        (_, index) => `    const value${String(index)} = ${String(index)};`,
    ).join('\n');
    const source = `export function count() {\n${declarations}\n    return value0;\n}\n`;
    await createFileTree(sandbox.path, { 'sample.test.js': source });
    const findings = await listLintFindings(eslint, sandbox.path, ['sample.test.js'], rules);
    expect(listFindingRules(findings)).toStrictEqual(
        level === 'all' ? rules.toSorted((left, right) => left.localeCompare(right)) : [],
    );
});

test.each([...LEVELS])(
    'trivial-file and trivial-function rules apply to root and nested files only at level all (%s)',
    async (level) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['javascript'], {
                level,
                scopes: [{ path: 'app', configurations: ['javascript'] }],
            }),
            'package.json': '{"private":true,"type":"module"}\n',
            'main.js': '',
            'app/main.js': '',
        });

        const eslint = await createEslint(sandbox.path);
        for (const filePath of ['main.js', 'app/main.js']) {
            await createFileTree(sandbox.path, { [filePath]: "export { launch as start } from './launch.js';" });
            expect(await listLintFindings(eslint, sandbox.path, [filePath], TRIVIAL_RULES)).toStrictEqual(
                level === 'all' ? [{ file: filePath, rule: 'gspot/no-trivial-files', line: 1 }] : [],
            );
            await createFileTree(sandbox.path, {
                [filePath]: 'function start() { return launch(); } export const app = start();',
            });
            expect(
                await listLintFindings(eslint, sandbox.path, [filePath], ['gspot/no-trivial-functions']),
            ).toStrictEqual(level === 'all' ? [{ file: filePath, rule: 'gspot/no-trivial-functions', line: 1 }] : []);
        }
    },
);

test('a JSON import attribute is accepted where your import extensions need a suffix', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            level: 'all',
            tables: '[tools.eslint]\nimport_extension = "js"\n\n',
            scopes: [{ path: 'app', configurations: ['javascript'] }],
        }),
        'package.json': '{"private":true,"type":"module","imports":{"#data/*":"./*.json"}}\n',
        'main.js': '',
        'app/main.js': '',
    });

    const eslint = await createEslint(sandbox.path);
    for (const filePath of ['main.js', 'app/main.js']) {
        const config = (await eslint.calculateConfigForFile(filePath)) as EslintConfiguration;
        expect(config.rules['n/file-extension-in-import']![0]).toBe(2);
        await createFileTree(sandbox.path, { [filePath]: 'import manifest from "#data/package";' });
        expect(await listLintFindings(eslint, sandbox.path, [filePath], ['no-restricted-syntax'])).toStrictEqual([
            { file: filePath, rule: 'no-restricted-syntax', line: 1 },
        ]);
        await createFileTree(sandbox.path, {
            [filePath]: 'import manifest from "#data/package" with { type: "json" };',
        });
        expect(await listLintFindings(eslint, sandbox.path, [filePath], ['no-restricted-syntax'])).toStrictEqual([]);
    }
});

test.each([...LEVEL_REEXPORT_CASES])(
    'at %s with reexports = %s, import, re-export and barrel rules apply in root and child scopes',
    async (level, reexports) => {
        await using sandbox = await testdir({
            ...IMPORT_FILES,
            'gspot.toml': buildSandboxSettings(['typescript'], {
                level,
                tables: `[structure]\nreexports = ${reexports === 'index-only' ? INDEX_ONLY_REEXPORTS : '"none"'}\n[limits]\nindex_exports = 2\n[[scope]]\npath = "app"\nconfigurations = ["typescript"]\n`,
            }),
        });
        const eslint = await createEslint(sandbox.path);
        await assertSourceRules(
            eslint,
            sandbox.path,
            ['src/source.ts', 'app/src/source.ts'],
            IMPORT_CASES.map(([name, source, rule, count]) => ({ name, source, rule, count })),
        );
        for (const file of ['src/source.ts', 'src/index.ts', 'app/src/source.ts', 'app/src/index.ts']) {
            const isBanned = level === 'all' && (reexports === 'none' || !file.endsWith('/index.ts'));
            await assertSourceRules(
                eslint,
                sandbox.path,
                [file],
                REEXPORT_CASES.map(([source, count]) => ({
                    source,
                    rule: 'no-restricted-syntax',
                    count: isBanned ? count : 0,
                })),
            );
        }
        const isBarrels = level === 'all' && reexports === 'index-only';
        if (isBarrels)
            await assertSourceRules(
                eslint,
                sandbox.path,
                ['src/index.ts', 'app/src/index.ts'],
                REEXPORT_CASES.map(([source]) => ({ source, rule: 'gspot/no-trivial-files', count: 0 })),
            );

        await assertSourceRules(
            eslint,
            sandbox.path,
            ['src/index.ts', 'app/src/index.ts'],
            BARREL_CASES.map(([name, source, count]) => ({
                name,
                source,
                rule: 'barrel-files/avoid-barrel-files',
                count: isBarrels ? count : 0,
            })),
        );
    },
);
