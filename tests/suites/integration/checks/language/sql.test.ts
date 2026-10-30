import { join } from 'node:path';
import { test, expect, beforeAll } from 'bun:test';
import { readFile, writeFile } from 'node:fs/promises';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { writeSandboxChanges } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { spawnGspot, listFindingRows, parseCheckReport } from '#tests/setup/cli/commands.ts';

import {
    SQL_CASES,
    SQL_SANDBOX,
    SQL_FUNCTION_SOURCE,
    SQLFLUFF_DIALECT_SETTINGS,
} from '#tests/config/integration/checks/language/language.ts';

const installedSandbox = shareInstalledSandbox(SQL_SANDBOX);

beforeAll(async () => {
    const ignored = await spawnGspot(installedSandbox().root, [
        'ignore',
        'sql/sqlfluff',
        '--paths',
        'db/report.sql',
        '--reason',
        'A script for psql, which the linter cannot read.',
    ]);
    expect(ignored.code, ignored.stdout + ignored.stderr).toBe(0);
});

test("SQLFluff uses each scope's dialect setting instead of the PostgreSQL default", async () => {
    const { root } = installedSandbox();
    await using _sourceChange = await writeSandboxChanges(installedSandbox(), {
        files: {
            'gspot.toml': buildSandboxSettings(['sql'], SQLFLUFF_DIALECT_SETTINGS),
            'query.sql': 'PRAGMA table_info (users);\n',
            'warehouse/query.sql': 'SELECT 1;\n',
            'warehouse/child/query.sql': 'FROM records SELECT id;\n',
        },
    });
    const wrong = await spawnGspot(root, ['check', 'query.sql', '--only', 'sql/sqlfluff', '--json']);
    expect(wrong.code, wrong.stdout + wrong.stderr).toBe(1);
    expect(listFindingRows(parseCheckReport(wrong).report)).toStrictEqual([
        { file: 'query.sql', line: 1, rule: 'PRS' },
    ]);
    const selected = await spawnGspot(root, ['set', 'tools.sqlfluff.dialect', 'sqlite']);
    expect(selected.code, selected.stdout + selected.stderr).toBe(0);
    const corrected = await spawnGspot(root, ['check', 'query.sql', '--only', 'sql/sqlfluff', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    const nested = await spawnGspot(root, ['check', 'warehouse/child/query.sql', '--only', 'sql/sqlfluff', '--json']);
    expect(nested.code, nested.stdout + nested.stderr).toBe(0);
    const warehouseDialect = await spawnGspot(root, [
        'set',
        'tools.sqlfluff.dialect',
        'postgres',
        '--scope',
        'warehouse',
    ]);
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

test('SQLFluff reports and fixes uppercase function names', async () => {
    const { root } = installedSandbox();
    await using _sourceChange = await writeSandboxChanges(installedSandbox(), {
        files: {
            'gspot.toml': buildSandboxSettings(['sql'], {
                level: 'all',
                tables: '[tools.sqlfluff]\ndialect = "postgres"\n',
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
    const fixed = await spawnGspot(root, [...command, '--fix']);
    expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
    expect(await readFile(join(root, 'functions.sql'), 'utf8')).toBe(SQL_FUNCTION_SOURCE);
    const corrected = await spawnGspot(root, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});

test.each([...SQL_CASES])('$check reports $expected.file and passes after the fix', async (sample) => {
    await assertCheckSample(installedSandbox(), sample);
});
