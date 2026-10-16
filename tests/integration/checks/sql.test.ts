import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import type { RunReport } from '#cli/types/checks/run/check.ts';
import { updateSandbox, registerSharedSandbox } from '#tests/setup/sandbox.ts';
import { runCheckSample, expectedSummary, summarizeSample } from '#tests/setup/sample-checks.ts';

import {
    SQL_CASES,
    SQL_SANDBOX,
    SQL_DUCKDB_SOURCE,
    SQL_FUNCTION_SOURCE,
    FOREIGN_DIALECT_CASES,
} from '#tests/data/checks/sql.ts';

/** Apply the Sql sources and restore them when their scenario finishes. */
async function prepareSqlFiles(files: Record<string, string>): Promise<AsyncDisposable> {
    const sandbox = installedSandbox();
    await using resources = new AsyncDisposableStack();
    resources.use(await updateSandbox(sandbox, { check: 'sql/sqlfluff', files }));
    const applied = await spawnGspot(sandbox.root, ['apply'], sandbox.environment);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    return resources.move();
}

test("SQLFluff uses each scope's dialect setting instead of the PostgreSQL default", async () => {
    const { root, environment } = installedSandbox();
    await using _sourceChange = await prepareSqlFiles({
        'gspot.toml': buildSettingsText(['sql'], {
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
    });
    const wrong = await spawnGspot(root, ['check', 'query.sql', '--only', 'sql/sqlfluff', '--json'], environment);
    expect(wrong.code, wrong.stdout + wrong.stderr).toBe(1);
    expect(hasSqlParseError(wrong.stdout)).toBe(true);
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
    expect(hasSqlParseError(wrongChild.stdout)).toBe(true);
});

test('SQLFluff accepts block comments and still reports a broken query', async () => {
    const { root, environment } = installedSandbox();
    const source = '/* Explains the query. */\nSELECT 1;\n';
    await using _sourceChange = await prepareSqlFiles({
        'gspot.toml': buildSettingsText(['sql'], { level: 'all' }),
        'query.sql': source,
    });
    const command = ['check', 'query.sql', '--only', 'sql/sqlfluff', '--json'];
    const accepted = await spawnGspot(root, command, environment);
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
    expect(await Bun.file(join(root, 'query.sql')).text()).toBe(source);
    await Bun.write(join(root, 'query.sql'), '/* Explains the query. */\nSELECT FROM;\n');
    const failed = await spawnGspot(root, command, environment);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(
        (JSON.parse(failed.stdout) as RunReport).checks
            .flatMap((check) => check.findings)
            .some((finding) => finding.rule === 'PRS'),
    ).toBe(true);
    await Bun.write(join(root, 'query.sql'), source);
    const corrected = await spawnGspot(root, command, environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});

test.each([...FOREIGN_DIALECT_CASES])(
    'SQLFluff parses the $dialect sample that PostgreSQL rejects',
    async ({ dialect, source }) => {
        const { root, environment } = installedSandbox();
        await using _sourceChange = await prepareSqlFiles({
            'gspot.toml': buildSettingsText(['sql'], { tables: `[tools.sqlfluff]\ndialect = "${dialect}"\n` }),
            'query.sql': source,
        });
        const command = ['check', 'query.sql', '--only', 'sql/sqlfluff', '--json'];
        const selected = await spawnGspot(root, command, environment);
        expect(selected.code, selected.stdout + selected.stderr).toBe(0);
        const change = await spawnGspot(root, ['set', 'tools.sqlfluff.dialect', 'postgres'], environment);
        expect(change.code, change.stdout + change.stderr).toBe(0);
        const rejected = await spawnGspot(root, command, environment);
        expect(rejected.code, rejected.stdout + rejected.stderr).toBe(1);
        expect(
            (JSON.parse(rejected.stdout) as RunReport).checks
                .flatMap((check) => check.findings)
                .some((finding) => finding.rule === 'PRS'),
        ).toBe(true);
    },
);

test('SQLFluff reports and fixes uppercase function names', async () => {
    const { root, environment } = installedSandbox();
    await using _sourceChange = await prepareSqlFiles({
        'gspot.toml': buildSettingsText(['sql'], {
            level: 'all',
            tables: '[tools.sqlfluff]\ndialect = "postgres"\n',
        }),
        'functions.sql': SQL_FUNCTION_SOURCE,
    });
    const command = ['check', 'functions.sql', '--only', 'sql/sqlfluff', '--json'];
    const positive = await spawnGspot(root, command, environment);
    expect(positive.code, positive.stdout + positive.stderr).toBe(0);
    await Bun.write(join(root, 'functions.sql'), SQL_FUNCTION_SOURCE.replaceAll('get_user_name', 'GET_USER_NAME'));
    const failed = await spawnGspot(root, command, environment);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(
        (JSON.parse(failed.stdout) as RunReport).checks
            .flatMap((check) => check.findings)
            .filter((finding) => finding.rule === 'CP03')
            .map(({ line, column }) => ({ line, column })),
    ).toStrictEqual([
        { line: 1, column: 17 },
        { line: 2, column: 8 },
    ]);
    const fixed = await spawnGspot(root, [...command, '--fix'], environment);
    expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
    expect(await Bun.file(join(root, 'functions.sql')).text()).toBe(SQL_FUNCTION_SOURCE);
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
    expect(summarizeSample(result)).toStrictEqual(expectedSummary(entry));
});

/** Identify SQL parser diagnostics in the public check report. */
function hasSqlParseError(stdout: string): boolean {
    return (JSON.parse(stdout) as RunReport).checks
        .flatMap((check) => check.findings)
        .some((finding) => finding.rule === 'PRS');
}
