import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { rename } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { containing } from '#tests/setup/matchers.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { TEST_PATH_FILES } from '#tests/config/naming/sources.ts';
import { runGspot, checkReport } from '#tests/setup/run-gspot.ts';
import { ORDINARY_WORDS, TEST_PATH_SETTINGS } from '#tests/config/naming/settings.ts';

test('an allowed property name does not hide a bad name on the next line', async () => {
    await using sandbox = await testdir();
    const source =
        'export type Template = {\n    external_key: string;\n    user_name: string;\n    USER_COUNT: number;\n};\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['typescript', 'naming'], {
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

test('a banned word is reported in a name, a file name and a folder name', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['javascript', 'naming'], { level: 'all' }),
        'helper.js': 'export const helperCommand = 1;\n',
        'helper/port.js': 'export const port = 1;\n',
    });
    const command = ['check', '--only', 'naming/identifiers', 'naming/paths', '--json'];
    const refused = await checkReport(sandbox.path, command);
    expect(refused.code, refused.stdout + refused.stderr).toBe(1);
    const report = refused.report;
    expect(report.checks.map((check) => [check.check, check.status])).toStrictEqual([
        ['naming/identifiers', 'failed'],
        ['naming/paths', 'failed'],
    ]);
    expect(report.checks[0]!.findings).toContainEqual(
        containing({ rule: 'banned-term', file: 'helper.js', line: 1, column: 14 }),
    );
    for (const file of ['helper.js', 'helper/port.js'])
        expect(report.checks[1]!.findings).toContainEqual(containing({ rule: 'banned-term', file, line: 1 }));
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

test("test-file exemptions follow each scope's test_files and Swift test names", async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': TEST_PATH_SETTINGS, ...TEST_PATH_FILES });
    const result = await checkReport(sandbox.path, ['check', '--only', 'naming/identifiers', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(1);
    const report = result.report;
    expect(report.checks.flatMap(({ findings }) => findings.map(({ file, rule }) => ({ file, rule })))).toStrictEqual([
        { file: 'Sources/Service.swift', rule: 'banned-term' },
        { file: 'src/entry.js', rule: 'banned-term' },
        { file: 'apps/api/verification/entry.js', rule: 'banned-term' },
        { file: 'apps/web/qa/entry.js', rule: 'banned-term' },
        { file: 'apps/web/src/entry.js', rule: 'banned-term' },
    ]);
});

test('ordinary words and number words pass; a banned word and a digit suffix are reported', async () => {
    await using sandbox = await testdir();
    const source = ORDINARY_WORDS.map((name) => `export const ${name} = 1;\n`).join('');
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['typescript', 'naming'], { level: 'all' }),
        'entry.ts': source + 'export const userHelper = 1;\n',
    });
    const command = ['check', '--only', 'naming/identifiers', '--json'];
    const failed = await checkReport(sandbox.path, command);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(failed.report.checks.flatMap(({ findings }) => findings)).toMatchObject([
        { file: 'entry.ts', line: ORDINARY_WORDS.length + 1, rule: 'banned-term' },
    ]);
    await Bun.write(join(sandbox.path, 'entry.ts'), source + 'export const userCount = 1;\n');
    const corrected = await checkReport(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks).toMatchObject([{ check: 'naming/identifiers', status: 'passed', findings: [] }]);
});
