import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { rename } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { matchFields } from '#tests/setup/matchers.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { runGspot, checkReport } from '#tests/setup/run-gspot.ts';
import { TEST_PATH_FILES } from '#tests/data/checks/naming/sources.ts';
import { ORDINARY_WORDS, FRAMEWORK_NAMES, TEST_PATH_SETTINGS } from '#tests/data/checks/naming/settings.ts';

test.each([...FRAMEWORK_NAMES])(
    "configuration-names: framework function names are allowed only inside the framework's scope",
    async ({ configuration, names, banned_words: bannedWords }) => {
        await using sandbox = await testdir();
        const source = names.map((name) => `export function ${name}() { return null; }\n`).join('');
        const variables = names.map((name) => `export const ${name} = () => null;\n`).join('');
        const declarations = names.map((name) => `    ${name}() { return null; }\n`).join('');
        const methods = `export class Reader {\n${declarations}}\n`;
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSettingsText(['typescript', 'naming'], {
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
            ...names.map((_, index) => ({ file: 'entry.ts', line: index + 1, rule: 'banned-word' })),
            { file: 'app/parameters.ts', line: 1, rule: 'banned-word' },
            ...names.map((_, index) => ({ file: 'sibling/entry.ts', line: index + 1, rule: 'banned-word' })),
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

test('configuration-names: SwiftLint owns Swift type case and length; banned words are still reported in types and parameters', async () => {
    await using sandbox = await testdir();
    const sourceText = 'typealias URLSession = String\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['swift', 'naming'], {
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
        { line: 1, rule: 'banned-word' },
        { line: 2, rule: 'banned-word' },
        { line: 3, rule: 'banned-word' },
    ]);
    await Bun.write(
        join(sandbox.path, 'Entry.swift'),
        'typealias URL = String\nlet entryCount = 1\nfunc readValue(client: String) {}\n',
    );
    const corrected = await checkReport(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks).toMatchObject([{ status: 'passed', findings: [] }]);
});

test('configuration-names: with pytest selected, the test_ prefix does not count as a word', async () => {
    await using sandbox = await testdir();
    const source = 'def test_read_account_summary_columns():\n    pass\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['python', 'naming'], {
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
test('identifiers: an allowed property name does not hide a bad name on the next line', async () => {
    await using sandbox = await testdir();
    const source =
        'export type Template = {\n    external_key: string;\n    user_name: string;\n    USER_COUNT: number;\n};\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['typescript', 'naming'], {
            tables: '[[naming.override]]\npaths = ["source.ts"]\ncategories = ["properties"]\nallowed_names = ["external_key"]\nreason = "The remote API fixes this exact property key."\n',
            level: 'all',
        }),
        'source.ts': source,
    });
    const command = ['check', '--json', '--only', 'naming/identifiers'];
    const failed = await checkReport(sandbox.path, command);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    const report = failed.report;
    expect(
        report.checks.flatMap(({ findings }) =>
            findings.map(({ file, line, column, rule }) => ({ file, line, column, rule })),
        ),
    ).toStrictEqual([{ file: 'source.ts', line: 3, column: 5, rule: 'case' }]);
    await Bun.write(join(sandbox.path, 'source.ts'), source.replace('user_name', 'userName'));
    const corrected = await runGspot(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});

test('identifiers: a banned word is reported in a name, a file name and a folder name', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['javascript', 'naming'], { level: 'all' }),
        'helper.js': 'export const helperCommand = 1;\n',
        'helper/port.js': 'export const port = 1;\n',
    });
    const command = ['check', '--only', 'naming/identifiers,naming/paths', '--json'];
    const refused = await checkReport(sandbox.path, command);
    expect(refused.code, refused.stdout + refused.stderr).toBe(1);
    const report = refused.report;
    expect(report.checks.map((check) => [check.check, check.status])).toStrictEqual([
        ['naming/identifiers', 'failed'],
        ['naming/paths', 'failed'],
    ]);
    expect(report.checks[0]!.findings).toContainEqual(
        matchFields({ rule: 'banned-word', file: 'helper.js', line: 1, column: 14 }),
    );
    for (const file of ['helper.js', 'helper/port.js'])
        expect(report.checks[1]!.findings).toContainEqual(matchFields({ rule: 'banned-word', file, line: 1 }));
    await rename(join(sandbox.path, 'helper.js'), join(sandbox.path, 'entry.js'));
    await rename(join(sandbox.path, 'helper'), join(sandbox.path, 'app'));
    await Bun.write(join(sandbox.path, 'entry.js'), 'export const command = 1;\n');
    const accepted = await checkReport(sandbox.path, command);
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
    expect(accepted.report.checks).toMatchObject([
        { check: 'naming/identifiers', status: 'passed', findings: [] },
        { check: 'naming/paths', status: 'passed', findings: [] },
    ]);
});

test("identifiers: test-file exemptions follow each scope's test_files and Swift test names", async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': TEST_PATH_SETTINGS, ...TEST_PATH_FILES });
    const result = await checkReport(sandbox.path, ['check', '--only', 'naming/identifiers', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(1);
    const report = result.report;
    expect(report.checks.flatMap(({ findings }) => findings.map(({ file, rule }) => ({ file, rule })))).toStrictEqual([
        { file: 'Sources/Service.swift', rule: 'banned-word' },
        { file: 'src/entry.js', rule: 'banned-word' },
        { file: 'apps/api/verification/entry.js', rule: 'banned-word' },
        { file: 'apps/web/qa/entry.js', rule: 'banned-word' },
        { file: 'apps/web/src/entry.js', rule: 'banned-word' },
    ]);
});

test('identifiers: ordinary words and number words pass; a banned word and a digit suffix are reported', async () => {
    await using sandbox = await testdir();
    const source = ORDINARY_WORDS.map((name) => `export const ${name} = 1;\n`).join('');
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['typescript', 'naming'], { level: 'all' }),
        'entry.ts': source + 'export const userHelper = 1;\n',
    });
    const command = ['check', '--only', 'naming/identifiers', '--json'];
    const failed = await checkReport(sandbox.path, command);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(failed.report.checks.flatMap(({ findings }) => findings)).toMatchObject([
        { file: 'entry.ts', line: ORDINARY_WORDS.length + 1, rule: 'banned-word' },
    ]);
    await Bun.write(join(sandbox.path, 'entry.ts'), source + 'export const userCount = 1;\n');
    const corrected = await checkReport(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks).toMatchObject([{ check: 'naming/identifiers', status: 'passed', findings: [] }]);
});
