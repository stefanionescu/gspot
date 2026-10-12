import type { ESLint } from 'eslint';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { LEVELS } from '#cli/config/configurations.ts';
import { settingsText } from '#tests/setup/settings.ts';
import type { SourceRuleCase } from '#tests/types/tool-output.ts';
import { createEslint, lintFindings, readEslintConfiguration } from '#tests/setup/generate.ts';

import {
    BARREL_CASES,
    IMPORT_CASES,
    IMPORT_FILES,
    TRIVIAL_RULES,
    REEXPORT_CASES,
    LEVEL_REEXPORT_CASES,
} from '#tests/config/eslint/structure.ts';

test('level all lints folders named like build output and skips folders marked linguist-generated in .gitattributes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['javascript'], {
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
    for (const filePath of ['tests/build/check.js', 'src/dist/check.js', 'coverage/check.js']) {
        expect(await eslint.isPathIgnored(filePath)).toBe(false);
        expect(await lintFindings(eslint, sandbox.path, [filePath], ['no-undef'])).toStrictEqual([
            { file: filePath, rule: 'no-undef', line: 1 },
        ]);
    }
    expect(await eslint.isPathIgnored('emitted/check.js')).toBe(true);
});

test.each([...LEVELS])('size limits apply to test files only at level all (%s)', async (level) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['javascript'], {
            tables: '[limits]\nfile_lines = 8\nfunction_lines = 5\nstatements = 3\n',
            level: level,
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
    const findings = await lintFindings(eslint, sandbox.path, ['sample.test.js'], rules);
    expect(
        [...new Set(findings.map(({ rule }) => rule))].toSorted((left, right) =>
            (left ?? '').localeCompare(right ?? ''),
        ),
    ).toStrictEqual(level === 'all' ? rules.toSorted((left, right) => left.localeCompare(right)) : []);
});

test.each([...LEVELS])(
    'trivial-file and trivial-function rules apply to root and nested files only at level all (%s)',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText(['javascript'], {
                tables: '[[scope]]\npath = "app"\nconfigurations = [ "javascript" ]\n',
                level: level,
            }),
            'package.json': '{"private":true,"type":"module"}\n',
            'main.js': '',
            'app/main.js': '',
        });
        const eslint = await createEslint(sandbox.path);
        for (const filePath of ['main.js', 'app/main.js']) {
            await createFileTree(sandbox.path, { [filePath]: 'export function start() { return launch(); }' });
            expect(await lintFindings(eslint, sandbox.path, [filePath], TRIVIAL_RULES)).toStrictEqual(
                level === 'all' ? [{ file: filePath, rule: 'gspot/no-trivial-files', line: 1 }] : [],
            );
            await createFileTree(sandbox.path, {
                [filePath]: 'function start() { return launch(); } export const app = start();',
            });
            expect(await lintFindings(eslint, sandbox.path, [filePath], ['gspot/no-trivial-functions'])).toStrictEqual(
                level === 'all' ? [{ file: filePath, rule: 'gspot/no-trivial-functions', line: 1 }] : [],
            );
        }
    },
);

test('a JSON import attribute is accepted where your import extensions need a suffix', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['javascript'], {
            tables: '[tools.eslint]\nimport_extension = "js"\n\n[[scope]]\npath = "app"\nconfigurations = [ "javascript" ]\n',
            level: 'all',
        }),
        'package.json': '{"private":true,"type":"module","imports":{"#manifest":"./package.json"}}\n',
        'main.js': '',
        'app/main.js': '',
    });
    const eslint = await createEslint(sandbox.path);
    for (const filePath of ['main.js', 'app/main.js']) {
        const config = await readEslintConfiguration(eslint, filePath);
        expect(config.rules['n/file-extension-in-import']![0]).toBe(2);
        await createFileTree(sandbox.path, { [filePath]: 'import manifest from "#manifest";' });
        expect(await lintFindings(eslint, sandbox.path, [filePath], ['no-restricted-syntax'])).toStrictEqual([
            { file: filePath, rule: 'no-restricted-syntax', line: 1 },
        ]);
        await createFileTree(sandbox.path, { [filePath]: 'import manifest from "#manifest" with { type: "json" };' });
        expect(await lintFindings(eslint, sandbox.path, [filePath], ['no-restricted-syntax'])).toStrictEqual([]);
    }
});

test.each(LEVEL_REEXPORT_CASES)(
    '%s %s: import, re-export and barrel rules in root and child scopes',
    async (level, reexports) => {
        await using sandbox = await testdir({
            ...IMPORT_FILES,
            'gspot.toml': settingsText(['typescript'], {
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

/** Check each retained native rule case in the supplied source files. */
async function assertSourceRules(
    eslint: ESLint,
    root: string,
    files: readonly string[],
    cases: readonly SourceRuleCase[],
): Promise<void> {
    for (const file of files) {
        for (const { name, source, rule, count } of cases) {
            await createFileTree(root, { [file]: source });
            const findings = await lintFindings(eslint, root, [file], [rule]);
            expect(findings, name).toStrictEqual(Array.from({ length: count }, () => ({ file, rule, line: 1 })));
        }
    }
}
