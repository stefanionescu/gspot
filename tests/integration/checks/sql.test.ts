import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile, writeFile } from 'node:fs/promises';
import type { ProcessOutput } from '#tests/types/processes.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/run-gspot.ts';
import { applySandboxChanges, registerSharedSandbox } from '#tests/setup/sandbox.ts';
import { runCheckSample, expectedSummary, buildSampleSummary } from '#tests/setup/sample-checks.ts';
import { SQL_CASES, SQL_SANDBOX, SQL_DUCKDB_SOURCE, SQL_FUNCTION_SOURCE } from '#tests/data/checks/sql.ts';

/** Find SQL parse errors in the check report. */
function hasSqlParseError(output: ProcessOutput): boolean {
    return parseCheckReport(output)
        .report.checks.flatMap((check) => check.findings)
        .some((finding) => finding.rule === 'PRS');
}

test("SQLFluff uses each scope's dialect setting instead of the PostgreSQL default", async () => {
    const { root, environment } = installedSandbox();
    await using _sourceChange = await applySandboxChanges(installedSandbox(), {
        check: 'sql/sqlfluff',
        files: {
            'gspot.toml': buildSandboxSettings(['sql'], {
                tables: `[tools.sqlfluff]
dialect = "postgres"
[[scope]]
path = "warehouse"
[scope.tools.sqlfluff]
dialect = "duckdb"
[[scope]]
path = "warehouse/child"
`,
            }),
            'query.sql': 'PRAGMA table_info (users);\n',
            'warehouse/query.sql': 'SELECT 1;\n',
            'warehouse/child/query.sql': SQL_DUCKDB_SOURCE,
        },
    });
    const wrong = await spawnGspot(root, ['check', 'query.sql', '--only', 'sql/sqlfluff', '--json'], environment);
    expect(wrong.code, wrong.stdout + wrong.stderr).toBe(1);
    expect(hasSqlParseError(wrong)).toBe(true);
    const selected = await spawnGspot(root, ['set', 'tools.sqlfluff.dialect', 'sqlite'], environment);
    expect(selected.code, selected.stdout + selected.stderr).toBe(0);
    const corrected = await spawnGspot(root, ['check', 'query.sql', '--only', 'sql/sqlfluff', '--json'], environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    const nested = await spawnGspot(
        root,
        ['check', 'warehouse/child/query.sql', '--only', 'sql/sqlfluff', '--json'],
        environment,
    );
    expect(nested.code, nested.stdout + nested.stderr).toBe(0);
    const rootDialect = await spawnGspot(
        root,
        ['set', 'tools.sqlfluff.dialect', 'postgres', '--scope', 'warehouse'],
        environment,
    );
    expect(rootDialect.code, rootDialect.stdout + rootDialect.stderr).toBe(0);
    const wrongChild = await spawnGspot(
        root,
        ['check', 'warehouse/child/query.sql', '--only', 'sql/sqlfluff', '--json'],
        environment,
    );
    expect(wrongChild.code, wrongChild.stdout + wrongChild.stderr).toBe(1);
    expect(hasSqlParseError(wrongChild)).toBe(true);
});

test('SQLFluff reports and fixes uppercase function names', async () => {
    const { root, environment } = installedSandbox();
    await using _sourceChange = await applySandboxChanges(installedSandbox(), {
        check: 'sql/sqlfluff',
        files: {
            'gspot.toml': buildSandboxSettings(['sql'], {
                level: 'all',
                tables: '[tools.sqlfluff]\ndialect = "postgres"\n',
            }),
            'functions.sql': SQL_FUNCTION_SOURCE,
        },
    });
    const command = ['check', 'functions.sql', '--only', 'sql/sqlfluff', '--json'];
    const positive = await spawnGspot(root, command, environment);
    expect(positive.code, positive.stdout + positive.stderr).toBe(0);
    await writeFile(join(root, 'functions.sql'), SQL_FUNCTION_SOURCE.replaceAll('get_user_name', 'GET_USER_NAME'));
    const failed = parseCheckReport(await spawnGspot(root, command, environment));
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(
        failed.report.checks
            .flatMap((check) => check.findings)
            .filter((finding) => finding.rule === 'CP03')
            .map(({ line, column }) => ({ line, column })),
    ).toStrictEqual([
        { line: 1, column: 17 },
        { line: 2, column: 8 },
    ]);
    const fixed = await spawnGspot(root, [...command, '--fix'], environment);
    expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
    expect(await readFile(join(root, 'functions.sql'), 'utf8')).toBe(SQL_FUNCTION_SOURCE);
    const corrected = await spawnGspot(root, command, environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});

const installedSandbox = registerSharedSandbox({
    ...SQL_SANDBOX,
    async prepare(root, environment) {
        const ignored = await spawnGspot(
            root,
            [
                'ignore',
                'sql/sqlfluff',
                '--paths',
                'db/report.sql',
                '--reason',
                'A script for psql, which the linter cannot read.',
            ],
            environment,
        );
        expect(ignored.code, ignored.stdout + ignored.stderr).toBe(0);
    },
});

test.each([...SQL_CASES])('$check reports $expected.file and passes after the fix', async (entry) => {
    const result = await runCheckSample(installedSandbox(), entry, SQL_SANDBOX);
    expect(buildSampleSummary(result)).toStrictEqual(expectedSummary(entry));
});
