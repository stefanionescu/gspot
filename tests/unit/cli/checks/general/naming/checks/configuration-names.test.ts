import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { checkReport } from '#tests/setup/run-gspot.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { FRAMEWORK_NAMES } from '#tests/config/naming/settings.ts';

test.each([...FRAMEWORK_NAMES])(
    "framework function names are allowed only inside the framework's scope",
    async ({ configuration, names, banned_words: bannedWords }) => {
        await using sandbox = await testdir();
        const source = names.map((name) => `export function ${name}() { return null; }\n`).join('');
        const variables = names.map((name) => `export const ${name} = () => null;\n`).join('');
        const declarations = names.map((name) => `    ${name}() { return null; }\n`).join('');
        const methods = `export class Reader {\n${declarations}}\n`;
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText(['typescript', 'naming'], {
                level: 'all',
                tables:
                    `[naming]\nbanned_words = ${JSON.stringify(bannedWords)}\n` +
                    `[[scope]]\npath = "app"\nconfigurations = ["${configuration}"]\n` +
                    '[[scope]]\npath = "sibling"\n',
            }),
            'entry.ts': source,
            'app/entry.ts': source,
            'app/bindings.ts': variables,
            'app/reader.ts': methods,
            'app/parameters.ts': `export function readValue(${names[0]}: string) { return null; }\n`,
            'sibling/entry.ts': source,
        });
        const command = ['check', '--only', 'naming/identifiers', '--json'];
        const failed = await checkReport(sandbox.path, command);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        expect(
            failed.report.checks.flatMap(({ findings }) =>
                findings.map(({ file, line, rule }) => ({ file, line, rule })),
            ),
        ).toStrictEqual([
            ...names.map((_, index) => ({ file: 'entry.ts', line: index + 1, rule: 'banned-term' })),
            { file: 'app/parameters.ts', line: 1, rule: 'banned-term' },
            ...names.map((_, index) => ({ file: 'sibling/entry.ts', line: index + 1, rule: 'banned-term' })),
        ]);
        for (const file of ['entry.ts', 'sibling/entry.ts']) {
            await Bun.write(join(sandbox.path, file), 'export function readValue() { return null; }\n');
        }
        await Bun.write(
            join(sandbox.path, 'app/parameters.ts'),
            'export function readValue(value: string) { return null; }\n',
        );
        const corrected = await checkReport(sandbox.path, command);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(corrected.report.checks.every(({ findings }) => findings.length === 0)).toBe(true);
    },
);

test('names other configurations allow are checked like any name in plain TypeScript', async () => {
    await using sandbox = await testdir();
    const source = ['env', 'response'].map((name) => `export function ${name}() { return null; }\n`).join('');
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['typescript', 'naming'], {
            level: 'all',
            tables: `[naming]\nbanned_words = ${JSON.stringify(['env', 'response'])}\n`,
        }),
        'entry.ts': source,
    });
    const command = ['check', '--only', 'naming/identifiers', '--json'];
    const failed = await checkReport(sandbox.path, command);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(
        failed.report.checks.flatMap(({ findings }) =>
            findings.filter(({ rule }) => rule === 'banned-term').map(({ line }) => line),
        ),
    ).toStrictEqual(['env', 'response'].map((_, index) => index + 1));
    await Bun.write(join(sandbox.path, 'entry.ts'), 'export function readValue() { return null; }\n');
    const corrected = await checkReport(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks).toMatchObject([{ status: 'passed', findings: [] }]);
});

test('SwiftLint owns Swift type case and length; banned terms are still reported in types and parameters', async () => {
    await using sandbox = await testdir();
    const sourceText = 'typealias URLSession = String\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['swift', 'naming'], {
            level: 'all',
            tables: '[naming]\nbanned_words = ["url session"]\n',
        }),
        'Entry.swift': sourceText + 'let helperCount = 1\nfunc readValue(URLSession: String) {}\n',
    });
    const command = ['check', '--only', 'naming/identifiers', '--json'];
    const failed = await checkReport(sandbox.path, command);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(
        failed.report.checks.flatMap(({ findings }) => findings.map(({ line, rule }) => ({ line, rule }))),
    ).toStrictEqual([
        { line: 1, rule: 'banned-term' },
        { line: 2, rule: 'banned-term' },
        { line: 3, rule: 'banned-term' },
    ]);
    await Bun.write(
        join(sandbox.path, 'Entry.swift'),
        'typealias URL = String\nlet entryCount = 1\nfunc readValue(client: String) {}\n',
    );
    const corrected = await checkReport(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks).toMatchObject([{ status: 'passed', findings: [] }]);
});

test('with pytest selected, the test_ prefix does not count as a word', async () => {
    await using sandbox = await testdir();
    const source = 'def test_read_account_summary_columns():\n    pass\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['python', 'naming'], {
            level: 'all',
            tables: '[[scope]]\npath = "app"\nconfigurations = ["pytest"]\n[[scope]]\npath = "sibling"\n',
        }),
        'test_entry.py': source,
        'app/test_entry.py': source,
        'sibling/test_entry.py': source,
    });
    const command = ['check', '--only', 'naming/identifiers', '--json'];
    const failed = await checkReport(sandbox.path, command);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(
        failed.report.checks.flatMap(({ findings }) => findings.map(({ file, line, rule }) => ({ file, line, rule }))),
    ).toStrictEqual([
        { file: 'test_entry.py', line: 1, rule: 'words' },
        { file: 'sibling/test_entry.py', line: 1, rule: 'words' },
    ]);
    for (const file of ['test_entry.py', 'sibling/test_entry.py']) {
        await Bun.write(join(sandbox.path, file), 'def read_account_summary_columns():\n    pass\n');
    }
    const corrected = await checkReport(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks.every(({ findings }) => findings.length === 0)).toBe(true);
});
