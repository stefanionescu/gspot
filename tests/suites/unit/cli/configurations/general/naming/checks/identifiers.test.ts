import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { runChecks } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import {
    FRAMEWORK_NAMES,
    PYTHON_TYPE_SOURCE,
    REACT_COMPONENT_SOURCE,
    TEST_FILE_FINDINGS,
    TEST_PATH_FILES,
    TEST_PATH_SETTINGS,
} from '#tests/config/configurations/naming/source-names.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings, validateSettingsText } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test.each([...FRAMEWORK_NAMES])(
    `$configuration's allowed function name $name passes only inside its scope`,
    async ({ configuration, name, bannedWords }) => {
        const source = `export function ${name}() { return null; }\n`;
        const variables = `export const ${name} = () => null;\n`;
        const declarations = `    ${name}() { return null; }\n`;
        const methods = `export class Reader {\n${declarations}}\n`;
        await using sandbox = await createGitSandbox({
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

        const failed = await runChecks(
            await openSession(sandbox.path),
            buildRunOptions({ only: ['naming/identifiers'] }),
        );

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
        const corrected = await runChecks(
            await openSession(sandbox.path),
            buildRunOptions({ only: ['naming/identifiers'] }),
        );

        expect(corrected.report.failed).toStrictEqual([]);
    },
);

test('SwiftLint owns the case and length of Swift types; banned words are still reported in types and parameters', async () => {
    const sourceText = 'typealias URLSession = String\n';
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['swift', 'naming'], {
            level: 'all',
            tables: '[naming]\nbanned_words = ["url session"]\n',
        }),
        'Entry.swift': sourceText + 'let helperCount = 1\nfunc readValue(URLSession: String) {}\n',
    });

    const failed = await runSandboxCheck(sandbox.path, 'naming/identifiers');

    expect(failed.map(({ line, rule }) => ({ line, rule }))).toStrictEqual([
        { line: 1, rule: 'banned-word' },
        { line: 2, rule: 'banned-word' },
        { line: 3, rule: 'banned-word' },
    ]);
    await writeFile(
        join(sandbox.path, 'Entry.swift'),
        'typealias URL = String\nlet entryCount = 1\nfunc readValue(client: String) {}\n',
    );
    const corrected = await runSandboxCheck(sandbox.path, 'naming/identifiers');

    expect(corrected).toStrictEqual([]);
});

test('a word of naming.terms in an identifier reports the word to use instead, and the renamed identifier passes', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript', 'naming'], {
            level: 'all',
            tables: '[naming]\nterms = { "config file" = "generated file" }\n',
        }),
        'entry.ts': 'export const configFilePath = "";\n',
    });

    const failed = await runSandboxCheck(sandbox.path, 'naming/identifiers');

    expect(failed.map(({ line, rule, message }) => ({ line, rule, message }))).toStrictEqual([
        {
            line: 1,
            rule: 'banned-word',
            message:
                'typescript variable "configFilePath": "config file" is banned (naming.terms). Use "generated file".',
        },
    ]);
    await writeFile(join(sandbox.path, 'entry.ts'), 'export const generatedFilePath = "";\n');
    expect(await runSandboxCheck(sandbox.path, 'naming/identifiers')).toStrictEqual([]);
});

test('with pytest selected, the test_ prefix does not count as a word', async () => {
    const source = 'def test_read_account_summary_columns():\n    pass\n';
    await using sandbox = await createGitSandbox({
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

    expect(corrected.report.failed).toStrictEqual([]);
});

test('the naming.typescript settings cover JavaScript files, and gspot refuses a naming.javascript table', async () => {
    const tables = '[naming.typescript]\nmax_words = 2\n';
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript', 'naming'], { tables, level: 'all' }),
        'source.js': 'export const pendingOrderCount = 1;\nexport const orderCount = 2;\n',
    });

    const failed = await runSandboxCheck(sandbox.path, 'naming/identifiers');

    expect(failed.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        { file: 'source.js', line: 1, rule: 'words' },
    ]);
    const refused = validateSettingsText(
        buildSandboxSettings(['javascript'], { tables: '[naming.javascript]\nmax_words = 2\n' }),
        sandbox.path,
    );
    expect(refused.join('\n')).toContain('naming.javascript');
});

test('an allowed property name does not hide a bad name on the next line', async () => {
    const source = "export class Template {\n    external_key = '';\n    user_name = '';\n    USER_COUNT = 0;\n}\n";
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript', 'naming'], {
            tables: '[[naming.exception]]\npaths = ["source.ts"]\ncategories = ["properties"]\nallowed_names = ["external_key"]\nreason = "The remote API fixes this exact property key."\n',
            level: 'all',
        }),
        'source.ts': source,
    });

    const failed = await runSandboxCheck(sandbox.path, 'naming/identifiers');

    expect(failed.map(({ file, line, column, rule }) => ({ file, line, column, rule }))).toStrictEqual([
        { file: 'source.ts', line: 3, column: 5, rule: 'case' },
    ]);
    await writeFile(join(sandbox.path, 'source.ts'), source.replace('user_name', 'userName'));
    const corrected = await runSandboxCheck(sandbox.path, 'naming/identifiers');
    expect(corrected).toStrictEqual([]);
});

test(`test-file exemptions follow each scope's test_files and Swift test names`, async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': TEST_PATH_SETTINGS, ...TEST_PATH_FILES });

    const result = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['naming/identifiers'] }));

    expect(
        result.report.checks.flatMap(({ findings }) => findings.map(({ file, rule }) => ({ file, rule }))),
    ).toStrictEqual([...TEST_FILE_FINDINGS]);
});

test('Python dunders and type aliases follow their own naming', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['python', 'naming'], { level: 'all' }),
        'source.py': [...PYTHON_TYPE_SOURCE].join('\n'),
    });

    const findings = await runSandboxCheck(sandbox.path, 'naming/identifiers');
    expect(findings.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        { file: 'source.py', line: 13, rule: 'case' },
    ]);
});

test('React component variables may take PascalCase, and destructured names keep their source spelling', async () => {
    await using sandbox = await createGitSandbox({
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

test('domain names customer, news and supported pass, and names that hold a banned word are reported', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript', 'naming'], { level: 'all' }),
        'orders.js':
            'export const customerId = 1;\nexport const newsFeed = 1;\nexport const supportedLocales = [];\nexport const finalScore = 1;\nexport const objectStore = {};\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'naming/identifiers');
    expect(findings.map(({ line, rule }) => ({ line, rule }))).toStrictEqual([
        { line: 4, rule: 'banned-word' },
        { line: 5, rule: 'banned-word' },
    ]);
});

test('Next.js JavaScript routes accept PascalCase components', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript', 'nextjs', 'naming'], { level: 'all' }),
        'app/blog/page.js': 'export default function Page() { return null; }\n',
        'pages/index.js': 'export default function Home() { return null; }\n',
    });
    expect(await runSandboxCheck(sandbox.path, 'naming/identifiers')).toStrictEqual([]);
});

test('cors stays a domain word while core and its word forms remain banned', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript', 'naming'], { level: 'all' }),
        'cors.js':
            'export const corsHeaders = {};\nexport const coreCount = 1;\nexport const cores = [];\nexport const cored = 1;\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'naming/identifiers');
    expect(findings.map(({ line }) => line)).toStrictEqual([2, 3, 4]);
});
