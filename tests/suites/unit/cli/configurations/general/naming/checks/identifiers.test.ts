import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { runChecks } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import {
    PYTHON_TYPE_SOURCE,
    REACT_COMPONENT_SOURCE,
    TEST_FILE_FINDINGS,
} from '#tests/config/configurations/naming/source-names.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { listFindingRows } from '#tests/setup/cli/commands.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

async function listIdentifierFindings(root: string) {
    const { report } = await runChecks(await openSession(root), buildRunOptions({ only: ['naming/identifiers'] }));
    return listFindingRows(report);
}

test("nextjs's allowed function name getServerSideProps passes only inside its scope", async () => {
    const name = 'getServerSideProps';
    const source = `export function ${name}() { return null; }\n`;
    const variables = `export const ${name} = () => null;\n`;
    const declarations = `    ${name}() { return null; }\n`;
    const methods = `export class Reader {\n${declarations}}\n`;
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript', 'naming'], {
            level: 'all',
            scopes: [{ path: 'app', configurations: ['nextjs'] }, { path: 'sibling' }],
            tables: '[naming]\nbanned_words = ["get server side props"]\n',
        }),
        'entry.ts': source,
        'app/entry.ts': source,
        'app/bindings.ts': variables,
        'app/reader.ts': methods,
        'app/parameters.ts': `export function readValue(${name}: string) { return null; }\n`,
        'sibling/entry.ts': source,
    });

    expect(await listIdentifierFindings(sandbox.path)).toStrictEqual([
        { file: 'entry.ts', line: 1, rule: 'banned-word' },
        { file: 'app/parameters.ts', line: 1, rule: 'banned-word' },
        { file: 'sibling/entry.ts', line: 1, rule: 'banned-word' },
    ]);
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

    expect(await listIdentifierFindings(sandbox.path)).toStrictEqual([
        { file: 'test_entry.py', line: 1, rule: 'words' },
        { file: 'sibling/test_entry.py', line: 1, rule: 'words' },
    ]);
});

test('the naming.typescript settings cover JavaScript files', async () => {
    const tables = '[naming.typescript]\nmax_words = 2\n';
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript', 'naming'], { tables, level: 'all' }),
        'source.js': 'export const pendingOrderCount = 1;\nexport const orderCount = 2;\n',
    });

    const failed = await runSandboxCheck(sandbox.path, 'naming/identifiers');

    expect(failed.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        { file: 'source.js', line: 1, rule: 'words' },
    ]);
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
    await using sandbox = await createGitSandbox({
        'gspot.toml': `level = "all"
configurations = ["javascript", "swift", "naming"]
test_files = ["qa/**"]
[[scope]]
path = "apps/web"
test_files = ["verification/**"]
[[scope]]
path = "apps/api"
`,
        'qa/entry.js': 'export const testcaseCount = 1;\n',
        '__tests__/default.js': 'export const testcaseCount = 1;\n',
        'Tests/Service.swift': 'let testcaseCount = 1\n',
        'Sources/ServiceTests.swift': 'let testcaseCount = 1\n',
        'apps/web/verification/entry.js': 'export const testcaseCount = 1;\n',
        'apps/web/qa/entry.js': 'export const testcaseCount = 1;\n',
        'apps/api/verification/entry.js': 'export const testcaseCount = 1;\n',
    });

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

test('a function named run and a function that starts with handle are reported, and a method named run, runMigrations, and runPackageManager pass', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript', 'naming'], { level: 'all' }),
        'entry.ts': `export function run(): void {}
export function handleRequest(): void {}
export function runMigrations(): void {}
export function runPackageManager(): void {}
export class Command {
    run(): void {}
}
`,
    });
    expect(await listIdentifierFindings(sandbox.path)).toStrictEqual([
        { file: 'entry.ts', line: 1, rule: 'banned-word' },
        { file: 'entry.ts', line: 2, rule: 'banned-word' },
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

test('a bash variable that a later readonly line names is reported once, at the line that declares it', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash', 'naming'], { level: 'all' }),
        'reset.sh':
            '#!/usr/bin/env bash\nSCRIPT_DIR="$(pwd)"\nreadonly SCRIPT_DIR\nreadonly CACHE_DIR="$(pwd)"\nreadonly LOG_DIR\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'naming/identifiers');
    expect(findings.map(({ line, column, rule }) => ({ line, column, rule }))).toStrictEqual([
        { line: 2, column: 1, rule: 'banned-word' },
        { line: 4, column: 10, rule: 'banned-word' },
        { line: 5, column: 10, rule: 'banned-word' },
    ]);
});

test('a SQL file that Postgres cannot parse reports syntax, except in a scope that sets another sql.dialect', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['sql', 'postgres', 'naming'], {
            tables: '[[scope]]\npath = "store"\n[scope.sql]\ndialect = "sqlite"\n',
        }),
        'pragma.sql': 'PRAGMA foreign_keys = ON;\n',
        'store/pragma.sql': 'PRAGMA foreign_keys = ON;\n',
        'store/tables.sql': 'CREATE TABLE user_helper (id integer);\n',
    });
    const session = await openSession(sandbox.path);
    const { report } = await runChecks(session, buildRunOptions({ only: ['naming/identifiers'] }));
    const findings = report.checks.flatMap((check) => check.findings);
    expect(findings.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        { file: 'pragma.sql', line: 1, rule: 'syntax' },
        { file: 'store/tables.sql', line: 1, rule: 'banned-word' },
    ]);
    expect(findings[0]?.help).toBeDefined();
});

test('useMDXComponents passes under nextjs', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript', 'nextjs', 'naming'], { level: 'all' }),
        'mdx-components.tsx': 'export function useMDXComponents() { return {}; }\n',
    });
    expect(await runSandboxCheck(sandbox.path, 'naming/identifiers')).toStrictEqual([]);
});

test('a React state setter does not count its set prefix', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript', 'react', 'naming'], { level: 'all' }),
        'size-fit.tsx':
            'const [isSizeFitShown, setIsSizeFitShown] = useState(false);\nconst [, setIsSizeFitPanelShown] = useState(false);\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'naming/identifiers');
    expect(findings.map(({ line, rule }) => ({ line, rule }))).toStrictEqual([{ line: 2, rule: 'words' }]);
});

test('SQL under the default dialect is not read as Postgres', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['sql', 'naming']),
        'seed.sql': "PRAGMA foreign_keys = ON;\nINSERT OR REPLACE INTO account (id, name) VALUES (1, 'Ada');\n",
    });
    expect(await runSandboxCheck(sandbox.path, 'naming/identifiers')).toStrictEqual([]);
});
