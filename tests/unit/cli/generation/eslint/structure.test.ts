import { join } from 'node:path';
import type { ESLint } from 'eslint';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { LEVELS } from '#cli/config/configurations.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { createEslint, listFindingRules, listLintFindings } from '#tests/setup/tool-files.ts';
import type { LintFinding, SourceRuleCase, EslintConfiguration } from '#tests/types/tool-output.ts';

import {
    BARREL_CASES,
    ENTRY_SOURCE,
    IMPORT_CASES,
    IMPORT_FILES,
    ENTRY_TABLES,
    ENTRY_FOLDERS,
    TRIVIAL_RULES,
    REEXPORT_CASES,
    STARTER_SOURCE,
    TRIVIAL_ENTRY_FILES,
    LEVEL_REEXPORT_CASES,
} from '#tests/data/generation/eslint/structure.ts';

// The files and rules that the generated ESLint tool file reports for the two trivial-code rules.
async function listTrivialFindings(root: string, settings: string): Promise<Pick<LintFinding, 'file' | 'rule'>[]> {
    await writeFile(join(root, 'gspot.toml'), settings);
    const eslint = await createEslint(root);
    const findings = await listLintFindings(eslint, root, ENTRY_FOLDERS, TRIVIAL_RULES);
    return findings.map(({ file, rule }) => ({ file, rule }));
}

// The files the trivial-file rule reports, sorted.
function listTrivialFiles(findings: Pick<LintFinding, 'file' | 'rule'>[]): string[] {
    const files = findings.filter(({ rule }) => rule === 'gspot/no-trivial-files').map(({ file }) => file);
    return [...new Set(files)].toSorted((left, right) => left.localeCompare(right));
}

/** Check each rule case against these source files. */
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

test.each([...LEVELS])(
    'entry-files > Knip entry files still get the trivial-file rules at %s, in nested scopes',
    async (level) => {
        await using sandbox = await testdir({
            'package.json': '{"name":"entry-sandbox","private":true,"type":"module"}',
            'src/start.js': STARTER_SOURCE,
            'src/main.js': ENTRY_SOURCE,
            'src/task.js': ENTRY_SOURCE,
            'api/src/start.js': STARTER_SOURCE,
            'api/src/main.js': ENTRY_SOURCE,
            'api/src/task.js': ENTRY_SOURCE,
        });

        const settings = buildSandboxSettings(['javascript'], { level, tables: ENTRY_TABLES });
        expect(listTrivialFiles(await listTrivialFindings(sandbox.path, settings))).toStrictEqual(
            level === 'all' ? [...TRIVIAL_ENTRY_FILES] : [],
        );
        await writeFile(
            join(sandbox.path, 'src/main.js'),
            "import { start } from './start.js';\nfunction boot() { start(); }\nboot();\n",
        );
        // An exported function counts as trivial too.
        const mainFindings =
            level === 'all'
                ? [
                      { file: 'src/main.js', rule: 'gspot/no-trivial-files' },
                      { file: 'src/main.js', rule: 'gspot/no-trivial-functions' },
                  ]
                : [];
        const findings = await listTrivialFindings(sandbox.path, settings);
        expect(findings.filter(({ file }) => file === 'src/main.js')).toStrictEqual(mainFindings);
        expect(listTrivialFiles(findings)).toStrictEqual(level === 'all' ? [...TRIVIAL_ENTRY_FILES] : []);
        await writeFile(
            join(sandbox.path, 'src/main.js'),
            "import { start } from './start.js';\nexport function boot() { start(); }\n",
        );
        const publicFindings = await listTrivialFindings(sandbox.path, settings);
        expect(publicFindings.filter(({ file }) => file === 'src/main.js')).toStrictEqual(mainFindings);
    },
);

test('structure > level all skips build output and files marked linguist-generated in .gitattributes', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            level: 'all',
        }),
        'package.json': '{"private":true,"type":"module"}\n',
        'tests/build/check.js': 'missing();',
        'src/dist/check.js': 'missing();',
        'coverage/check.js': 'missing();',
        'emitted/check.js': 'missing();',
        '.gitattributes': 'emitted/** linguist-generated\n',
    });

    const eslint = await createEslint(sandbox.path);
    for (const filePath of ['tests/build/check.js', 'src/dist/check.js', 'coverage/check.js', 'emitted/check.js']) {
        expect(await eslint.isPathIgnored(filePath)).toBe(true);
    }
});

test.each([...LEVELS])('structure > size limits apply to test files only at level all (%s)', async (level) => {
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
    'structure > trivial-file and trivial-function rules apply to root and nested files only at level all (%s)',
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
            await createFileTree(sandbox.path, { [filePath]: 'export function start() { return launch(); }' });
            expect(await listLintFindings(eslint, sandbox.path, [filePath], TRIVIAL_RULES)).toStrictEqual(
                level === 'all'
                    ? [
                          { file: filePath, rule: 'gspot/no-trivial-files', line: 1 },
                          { file: filePath, rule: 'gspot/no-trivial-functions', line: 1 },
                      ]
                    : [],
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

test('structure > a JSON import attribute is accepted where your import extensions need a suffix', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            level: 'all',
            tables: '[tools.eslint]\nimport_extension = "js"\n\n',
            scopes: [{ path: 'app', configurations: ['javascript'] }],
        }),
        'package.json': '{"private":true,"type":"module","imports":{"#manifest":"./package.json"}}\n',
        'main.js': '',
        'app/main.js': '',
    });

    const eslint = await createEslint(sandbox.path);
    for (const filePath of ['main.js', 'app/main.js']) {
        const config = (await eslint.calculateConfigForFile(filePath)) as EslintConfiguration;
        expect(config.rules['n/file-extension-in-import']![0]).toBe(2);
        await createFileTree(sandbox.path, { [filePath]: 'import manifest from "#manifest";' });
        expect(await listLintFindings(eslint, sandbox.path, [filePath], ['no-restricted-syntax'])).toStrictEqual([
            { file: filePath, rule: 'no-restricted-syntax', line: 1 },
        ]);
        await createFileTree(sandbox.path, {
            [filePath]: 'import manifest from "#manifest" with { type: "json" };',
        });
        expect(await listLintFindings(eslint, sandbox.path, [filePath], ['no-restricted-syntax'])).toStrictEqual([]);
    }
});

test.each([...LEVEL_REEXPORT_CASES])(
    'structure > %s %s: import, re-export and barrel rules in root and child scopes',
    async (level, reexports) => {
        await using sandbox = await testdir({
            ...IMPORT_FILES,
            'gspot.toml': buildSandboxSettings(['typescript'], {
                level,
                tables: `[structure]\nreexports = ${reexports === 'index-only' ? '{ value = "index-only", reason = "The package exports its public index files." }' : '"none"'}\n[limits]\nindex_exports = 2\n[[scope]]\npath = "app"\nconfigurations = ["typescript"]\n`,
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
            const banned = level === 'all' && (reexports === 'none' || !file.endsWith('/index.ts'));
            await assertSourceRules(
                eslint,
                sandbox.path,
                [file],
                REEXPORT_CASES.map(([source, count]) => ({
                    source,
                    rule: 'no-restricted-syntax',
                    count: banned ? count : 0,
                })),
            );
        }
        const barrels = level === 'all' && reexports === 'index-only';
        if (barrels)
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
                count: barrels ? count : 0,
            })),
        );
    },
);
