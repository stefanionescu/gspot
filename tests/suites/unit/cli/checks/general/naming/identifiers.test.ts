import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { runChecks } from '#cli/commands/check/run.ts';
import type { RunResult } from '#cli/types/runs/run.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

import {
    FRAMEWORK_NAMES,
    TEST_PATH_FILES,
    TEST_PATH_SETTINGS,
    PYTHON_TYPE_SOURCE,
    TEST_FILE_FINDINGS,
    REACT_COMPONENT_SOURCE,
} from '#tests/config/checks/general/naming/identifiers.ts';

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 9 calls in this file share it.
async function checkIdentifiers(root: string): Promise<RunResult> {
    return runChecks(await openSession(root), buildRunOptions({ only: ['naming/identifiers'] }));
}

test.each([...FRAMEWORK_NAMES])(
    `a framework's allowed function name passes only inside the framework's scope`,
    async ({ configuration, name, bannedWords }) => {
        const source = `export function ${name}() { return null; }\n`;
        const variables = `export const ${name} = () => null;\n`;
        const declarations = `    ${name}() { return null; }\n`;
        const methods = `export class Reader {\n${declarations}}\n`;
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['typescript', 'naming'], {
                level: 'all',
                scopes: [{ path: 'app', configurations: [configuration] }, { path: 'sibling' }],
                tables: `[naming]\nbanned_words = ${JSON.stringify(bannedWords)}\n`,
            }),
            'entry.ts': source,
            'app/entry.ts': source,
            'app/bindings.ts': variables,
            'app/reader.ts': methods,
            'app/parameters.ts': `export function readValue(${name}: string) { return null; }\n`,
            'sibling/entry.ts': source,
        });

        const failed = await checkIdentifiers(sandbox.path);

        expect(
            failed.report.checks.flatMap(({ findings }) =>
                findings.map(({ file, line, rule }) => ({ file, line, rule })),
            ),
        ).toStrictEqual([
            { file: 'entry.ts', line: 1, rule: 'banned-word' },
            { file: 'app/parameters.ts', line: 1, rule: 'banned-word' },
            { file: 'sibling/entry.ts', line: 1, rule: 'banned-word' },
        ]);
        for (const file of ['entry.ts', 'sibling/entry.ts']) {
            await writeFile(join(sandbox.path, file), 'export function readValue() { return null; }\n');
        }
        await writeFile(
            join(sandbox.path, 'app/parameters.ts'),
            'export function readValue(value: string) { return null; }\n',
        );
        const corrected = await checkIdentifiers(sandbox.path);

        expect(corrected.report.failed).toStrictEqual([]);
    },
);

test('SwiftLint owns the case and length of Swift types; banned words are still reported in types and parameters', async () => {
    const sourceText = 'typealias URLSession = String\n';
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['swift', 'naming'], {
            level: 'all',
            tables: '[naming]\nbanned_words = ["url session"]\n',
        }),
        'Entry.swift': sourceText + 'let helperCount = 1\nfunc readValue(URLSession: String) {}\n',
    });

    const failed = await checkIdentifiers(sandbox.path);

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
    const corrected = await checkIdentifiers(sandbox.path);

    expect(corrected.report.checks).toMatchObject([{ status: 'passed', findings: [] }]);
});

test('with pytest selected, the test_ prefix does not count as a word', async () => {
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

    const failed = await checkIdentifiers(sandbox.path);

    expect(
        failed.report.checks.flatMap(({ findings }) => findings.map(({ file, line, rule }) => ({ file, line, rule }))),
    ).toStrictEqual([
        { file: 'test_entry.py', line: 1, rule: 'words' },
        { file: 'sibling/test_entry.py', line: 1, rule: 'words' },
    ]);
    for (const file of ['test_entry.py', 'sibling/test_entry.py']) {
        await writeFile(join(sandbox.path, file), 'def read_account_summary_columns():\n    pass\n');
    }
    const corrected = await checkIdentifiers(sandbox.path);

    expect(corrected.report.failed).toStrictEqual([]);
});
test('an allowed property name does not hide a bad name on the next line', async () => {
    const source =
        'export type Template = {\n    external_key: string;\n    user_name: string;\n    USER_COUNT: number;\n};\n';
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript', 'naming'], {
            tables: '[[naming.override]]\npaths = ["source.ts"]\ncategories = ["properties"]\nallowed_names = ["external_key"]\nreason = "The remote API fixes this exact property key."\n',
            level: 'all',
        }),
        'source.ts': source,
    });

    const failed = await checkIdentifiers(sandbox.path);

    expect(
        failed.report.checks.flatMap(({ findings }) =>
            findings.map(({ file, line, column, rule }) => ({ file, line, column, rule })),
        ),
    ).toStrictEqual([{ file: 'source.ts', line: 3, column: 5, rule: 'case' }]);
    await writeFile(join(sandbox.path, 'source.ts'), source.replace('user_name', 'userName'));
    const corrected = await checkIdentifiers(sandbox.path);
    expect(corrected.report.failed).toStrictEqual([]);
});

test(`test-file exemptions follow each scope's test_files and Swift test names`, async () => {
    await using sandbox = await testdir({ 'gspot.toml': TEST_PATH_SETTINGS, ...TEST_PATH_FILES });

    const result = await checkIdentifiers(sandbox.path);

    expect(
        result.report.checks.flatMap(({ findings }) => findings.map(({ file, rule }) => ({ file, rule }))),
    ).toStrictEqual([...TEST_FILE_FINDINGS]);
});

test('Python dunders and type aliases follow their own naming', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['python', 'naming'], { level: 'all' }),
        'source.py': [...PYTHON_TYPE_SOURCE].join('\n'),
    });

    const findings = await runSandboxCheck(sandbox.path, 'naming/identifiers');
    expect(findings.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        { file: 'source.py', line: 13, rule: 'case' },
    ]);
});

test('React component variables may take PascalCase, and destructured names keep their source spelling', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript', 'react', 'naming'], { level: 'all' }),
        'context.ts': [...REACT_COMPONENT_SOURCE].join('\n'),
        'header.tsx': 'export const Header = readHeader();\n',
    });

    const findings = await runSandboxCheck(sandbox.path, 'naming/identifiers');
    expect(findings.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        { file: 'context.ts', line: 6, rule: 'case' },
        { file: 'context.ts', line: 7, rule: 'case' },
    ]);
});

test('domain names customer, news and supported pass while whole banned terms are reported', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript', 'naming'], { level: 'all' }),
        'orders.js':
            'export const customerId = 1;\nexport const newsFeed = 1;\nexport const supportedLocales = [];\nexport const finalScore = 1;\nexport const objectStore = {};\n',
    });
    const checked = await runSandboxCheck(sandbox.path, 'naming/identifiers');
    expect(checked.map(({ line, rule }) => ({ line, rule }))).toStrictEqual([
        { line: 4, rule: 'banned-word' },
        { line: 5, rule: 'banned-word' },
    ]);
});

test('Next.js JavaScript routes accept PascalCase components', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript', 'nextjs', 'naming'], { level: 'all' }),
        'app/blog/page.js': 'export default function Page() { return null; }\n',
        'pages/index.js': 'export default function Home() { return null; }\n',
    });
    expect(await runSandboxCheck(sandbox.path, 'naming/identifiers')).toStrictEqual([]);
});
