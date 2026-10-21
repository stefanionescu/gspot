import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runChecks } from '#cli/runs/run.ts';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { buildRunOptions } from '#tests/setup/builders.ts';
import { checkFindings } from '#tests/setup/check-input.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { TEST_PATH_FILES } from '#tests/data/checks/naming/sources.ts';
import { FRAMEWORK_NAMES, TEST_PATH_SETTINGS } from '#tests/data/checks/naming/settings.ts';

test.each([...FRAMEWORK_NAMES])(
    "configuration-names: framework function names are allowed only inside the framework's scope",
    async ({ configuration, names, banned_words: bannedWords }) => {
        const source = names.map((name) => `export function ${name}() { return null; }\n`).join('');
        const variables = names.map((name) => `export const ${name} = () => null;\n`).join('');
        const declarations = names.map((name) => `    ${name}() { return null; }\n`).join('');
        const methods = `export class Reader {\n${declarations}}\n`;
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['typescript', 'naming'], {
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

        const failed = await runChecks(
            await openSession(sandbox.path),
            buildRunOptions({ only: ['naming/identifiers'] }),
        );

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
            await writeFile(join(sandbox.path, file), 'export function readValue() { return null; }\n');
        }
        await writeFile(
            join(sandbox.path, 'app/parameters.ts'),
            'export function readValue(value: string) { return null; }\n',
        );
        const corrected = await runChecks(
            await openSession(sandbox.path),
            buildRunOptions({ only: ['naming/identifiers'] }),
        );

        expect(corrected.report.checks.every(({ findings }) => findings.length === 0)).toBe(true);
    },
);

test('configuration-names: SwiftLint owns Swift type case and length; banned words are still reported in types and parameters', async () => {
    const sourceText = 'typealias URLSession = String\n';
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['swift', 'naming'], {
            level: 'all',
            tables: '[naming]\nbanned_words = ["url session"]\n',
        }),
        'Entry.swift': sourceText + 'let helperCount = 1\nfunc readValue(URLSession: String) {}\n',
    });

    const failed = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['naming/identifiers'] }));

    expect(
        failed.report.checks.flatMap(({ findings }) => findings.map(({ line, rule }) => ({ line, rule }))),
    ).toStrictEqual([
        { line: 1, rule: 'banned-word' },
        { line: 2, rule: 'banned-word' },
        { line: 3, rule: 'banned-word' },
    ]);
    await writeFile(
        join(sandbox.path, 'Entry.swift'),
        'typealias URL = String\nlet entryCount = 1\nfunc readValue(client: String) {}\n',
    );
    const corrected = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['naming/identifiers'] }),
    );

    expect(corrected.report.checks).toMatchObject([{ status: 'passed', findings: [] }]);
});

test('configuration-names: with pytest selected, the test_ prefix does not count as a word', async () => {
    const source = 'def test_read_account_summary_columns():\n    pass\n';
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['python', 'naming'], {
            level: 'all',
            scopes: [{ path: 'app', configurations: ['pytest'] }, { path: 'sibling' }],
        }),
        'test_entry.py': source,
        'app/test_entry.py': source,
        'sibling/test_entry.py': source,
    });

    const failed = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['naming/identifiers'] }));

    expect(
        failed.report.checks.flatMap(({ findings }) => findings.map(({ file, line, rule }) => ({ file, line, rule }))),
    ).toStrictEqual([
        { file: 'test_entry.py', line: 1, rule: 'words' },
        { file: 'sibling/test_entry.py', line: 1, rule: 'words' },
    ]);
    for (const file of ['test_entry.py', 'sibling/test_entry.py']) {
        await writeFile(join(sandbox.path, file), 'def read_account_summary_columns():\n    pass\n');
    }
    const corrected = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['naming/identifiers'] }),
    );

    expect(corrected.report.checks.every(({ findings }) => findings.length === 0)).toBe(true);
});
test('identifiers: an allowed property name does not hide a bad name on the next line', async () => {
    const source =
        'export type Template = {\n    external_key: string;\n    user_name: string;\n    USER_COUNT: number;\n};\n';
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript', 'naming'], {
            tables: '[[naming.override]]\npaths = ["source.ts"]\ncategories = ["properties"]\nallowed_names = ["external_key"]\nreason = "The remote API fixes this exact property key."\n',
            level: 'all',
        }),
        'source.ts': source,
    });

    const failed = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['naming/identifiers'] }));

    const report = failed.report;
    expect(
        report.checks.flatMap(({ findings }) =>
            findings.map(({ file, line, column, rule }) => ({ file, line, column, rule })),
        ),
    ).toStrictEqual([{ file: 'source.ts', line: 3, column: 5, rule: 'case' }]);
    await writeFile(join(sandbox.path, 'source.ts'), source.replace('user_name', 'userName'));
    const corrected = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['naming/identifiers'] }),
    );
    expect(corrected.report.failed).toStrictEqual([]);
});

test("identifiers: test-file exemptions follow each scope's test_files and Swift test names", async () => {
    await using sandbox = await testdir({ 'gspot.toml': TEST_PATH_SETTINGS, ...TEST_PATH_FILES });

    const result = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['naming/identifiers'] }));

    const report = result.report;
    expect(report.checks.flatMap(({ findings }) => findings.map(({ file, rule }) => ({ file, rule })))).toStrictEqual([
        { file: 'Sources/Service.swift', rule: 'banned-word' },
        { file: 'src/entry.js', rule: 'banned-word' },
        { file: 'apps/api/verification/entry.js', rule: 'banned-word' },
        { file: 'apps/web/qa/entry.js', rule: 'banned-word' },
        { file: 'apps/web/src/entry.js', rule: 'banned-word' },
    ]);
});

test('identifiers: Python dunders and type aliases follow their own naming', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['python', 'naming'], { level: 'all' }),
        'source.py': [
            'from typing import Literal, Optional, TypeAlias',
            'Mode = Literal["read", "write"]',
            'ModeChoice = Optional[Mode] | None',
            'Reading: TypeAlias = "Reader"',
            '_Private = dict[str, int]',
            'READ_FLAG = 1',
            'ACCESS_FLAGS = READ_FLAG | 2',
            'class Reader:',
            '    def __init_subclass__(cls):',
            '        pass',
            '    def __rich_repr__(self):',
            '        pass',
            'badAlias = Literal["x"]',
            '',
        ].join('\n'),
    });

    const findings = await checkFindings(sandbox.path, 'naming/identifiers');
    expect(findings.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        { file: 'source.py', line: 13, rule: 'case' },
    ]);
});

test('identifiers: React component variables may take PascalCase, and destructured names keep their source spelling', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript', 'react', 'naming'], { level: 'all' }),
        'context.ts': [
            "import { createContext, memo } from 'react';",
            "import styled from 'styled-components';",
            'export const CartContext = createContext(null);',
            'export const Row = memo(() => null);',
            'export const Title = styled.h1`font-weight: bold;`;',
            'export const BadValue = readValue();',
            'const { user_name, account: bad_account } = payload;',
            'export const names = [user_name, bad_account];',
            '',
        ].join('\n'),
        'header.tsx': 'export const Header = readHeader();\n',
    });

    const findings = await checkFindings(sandbox.path, 'naming/identifiers');
    expect(findings.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        { file: 'context.ts', line: 6, rule: 'case' },
        { file: 'context.ts', line: 7, rule: 'case' },
    ]);
});
