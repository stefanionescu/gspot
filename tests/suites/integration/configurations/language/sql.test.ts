import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { listFindingRows, parseCheckReport, spawnGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { writeSandboxChanges } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';

const SQL_SANDBOX = {
    configurations: ['sql'],
    files: {},
} as const;

const SQL_FUNCTION_SOURCE = `CREATE FUNCTION get_user_name() RETURNS TEXT AS $$ SELECT 'Alex'; $$ LANGUAGE sql;
SELECT get_user_name();
`;

const SQLFLUFF_DIALECT_SETTINGS = {
    tables: `[sql]
dialect = "postgres"
[[scope]]
path = "warehouse"
[scope.sql]
dialect = "duckdb"
[[scope]]
path = "warehouse/child"
`,
} as const;

const installedSandbox = shareInstalledSandbox(SQL_SANDBOX);

test("SQLFluff uses each scope's dialect setting instead of the PostgreSQL default", async () => {
    const { root } = installedSandbox();
    await using _sourceChange = await writeSandboxChanges(installedSandbox(), {
        files: {
            'gspot.toml': buildSandboxSettings(['sql'], SQLFLUFF_DIALECT_SETTINGS),
            'query.sql': 'PRAGMA table_info (users);\n',
            'warehouse/child/query.sql': 'FROM records SELECT id;\n',
        },
    });
    const wrong = await spawnGspot(root, ['check', 'query.sql', '--only', 'sql/sqlfluff', '--json']);
    expect(wrong.code, wrong.stdout + wrong.stderr).toBe(1);
    expect(listFindingRows(parseCheckReport(wrong).report)).toStrictEqual([
        { file: 'query.sql', line: 1, rule: 'PRS' },
    ]);
    const selected = await spawnGspot(root, ['set', 'sql.dialect', 'sqlite']);
    expect(selected.code, selected.stdout + selected.stderr).toBe(0);
    const corrected = await spawnGspot(root, ['check', 'query.sql', '--only', 'sql/sqlfluff', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    const nested = await spawnGspot(root, ['check', 'warehouse/child/query.sql', '--only', 'sql/sqlfluff', '--json']);
    expect(nested.code, nested.stdout + nested.stderr).toBe(0);
    const warehouseDialect = await spawnGspot(root, ['set', 'sql.dialect', 'postgres', '--scope', 'warehouse']);
    expect(warehouseDialect.code, warehouseDialect.stdout + warehouseDialect.stderr).toBe(0);
    const wrongChild = await spawnGspot(root, [
        'check',
        'warehouse/child/query.sql',
        '--only',
        'sql/sqlfluff',
        '--json',
    ]);
    expect(wrongChild.code, wrongChild.stdout + wrongChild.stderr).toBe(1);
    expect(listFindingRows(parseCheckReport(wrongChild).report)).toStrictEqual([
        { file: 'warehouse/child/query.sql', line: 1, rule: 'PRS' },
    ]);
});

test('SQLFluff reports uppercase function names', async () => {
    const { root } = installedSandbox();
    await using _sourceChange = await writeSandboxChanges(installedSandbox(), {
        files: {
            'gspot.toml': buildSandboxSettings(['sql'], {
                level: 'all',
                tables: '[sql]\ndialect = "postgres"\n',
            }),
            'functions.sql': SQL_FUNCTION_SOURCE,
        },
    });
    const command = ['check', 'functions.sql', '--only', 'sql/sqlfluff', '--json'];
    const clean = await spawnGspot(root, command);
    expect(clean.code, clean.stdout + clean.stderr).toBe(0);
    await writeFile(join(root, 'functions.sql'), SQL_FUNCTION_SOURCE.replaceAll('get_user_name', 'GET_USER_NAME'));
    const failed = parseCheckReport(await spawnGspot(root, command));
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(failed.report.checks[0]!.findings.map(({ line, column, rule }) => ({ line, column, rule }))).toStrictEqual([
        { line: 1, column: 17, rule: 'CP03' },
        { line: 2, column: 8, rule: 'CP03' },
    ]);
});

test('SQLFluff marks only the findings that its fixer corrects, and --fix rewrites them', async () => {
    const { root } = installedSandbox();
    await using _sourceChange = await writeSandboxChanges(installedSandbox(), {
        files: {
            'gspot.toml': buildSandboxSettings(['sql'], { tables: '[sql]\ndialect = "postgres"\n' }),
            'keywords.sql': 'select id from user_accounts;\n',
            'wildcard.sql': 'SELECT * FROM orders;\n',
        },
    });
    const failed = parseCheckReport(await spawnGspot(root, ['check', '--only', 'sql/sqlfluff', '--json']));
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(
        failed.report.checks[0]!.findings.map(({ file, column, rule, fixable }) => ({ file, column, rule, fixable })),
    ).toStrictEqual([
        { file: 'keywords.sql', column: 1, rule: 'CP01', fixable: true },
        { file: 'keywords.sql', column: 11, rule: 'CP01', fixable: true },
        { file: 'wildcard.sql', column: 8, rule: 'AM04', fixable: false },
    ]);
    const fixed = await spawnGspot(root, ['check', 'keywords.sql', '--only', 'sql/sqlfluff', '--fix', '--json']);
    expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
    expect(await readFile(join(root, 'keywords.sql'), 'utf8')).toBe('SELECT id FROM user_accounts;\n');
});
