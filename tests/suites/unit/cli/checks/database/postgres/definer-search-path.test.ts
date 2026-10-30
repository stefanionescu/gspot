import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { matchFields } from '#tests/setup/matchers.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { SECURITY_DEFINER_MESSAGE } from '#tests/config/checks/database/postgres/messages.ts';

import {
    DEFINER_REPAIRS,
    SECURITY_ALTERATIONS,
    DEFINER_FUNCTION_SQL,
} from '#tests/config/checks/database/postgres/postgres.ts';

test.each([...DEFINER_REPAIRS])('definer-search-path accepts a later $name migration', async ({ sql }) => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['postgres'], {
            level: 'all',
            tables: '[postgres]\nfrozen_through = "1"\n',
        }),
        'migrations/1_definer.sql': DEFINER_FUNCTION_SQL,
        'migrations/2_repair.sql': sql,
    });
    expect(await runSandboxCheck(sandbox.path, 'postgres/definer-search-path')).toStrictEqual([]);
});

test('definer-search-path keeps an unsafe overload when another signature is repaired', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['postgres'], { level: 'all' }),
        'migrations/1_definer.sql': DEFINER_FUNCTION_SQL,
        'migrations/2_overload.sql':
            'CREATE FUNCTION public.grant_access(account_id int) RETURNS void LANGUAGE sql SECURITY DEFINER AS $$ SELECT 1 $$;\n',
        'migrations/3_repair.sql': "ALTER FUNCTION public.grant_access() SET search_path = '';\n",
    });
    expect(await runSandboxCheck(sandbox.path, 'postgres/definer-search-path')).toStrictEqual([
        {
            check: 'postgres/definer-search-path',
            file: 'migrations/2_overload.sql',
            line: 1,
            column: 1,
            rule: 'definer-search-path',
            message: SECURITY_DEFINER_MESSAGE,
            fixable: false,
            help: "Set an explicit `search_path` in the definition, such as `SET search_path = ''`, and qualify every name inside it.",
        },
    ]);
});

test('definer-search-path reports a SECURITY DEFINER function without search_path and passes once it sets one', async () => {
    const path = 'migrations/1_access.sql';
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['postgres'], { level: 'all' }),
        [path]: DEFINER_FUNCTION_SQL,
    });
    expect(await runSandboxCheck(sandbox.path, 'postgres/definer-search-path')).toStrictEqual([
        matchFields({
            file: path,
            line: 1,
            rule: 'definer-search-path',
            message: SECURITY_DEFINER_MESSAGE,
        }),
    ]);
    await writeFile(
        join(sandbox.path, path),
        "CREATE FUNCTION grant_access() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$ SELECT 1 $$;\n",
    );
    expect(await runSandboxCheck(sandbox.path, 'postgres/definer-search-path')).toStrictEqual([]);
});

test.each([...SECURITY_ALTERATIONS])(
    'definer-search-path replays ALTER FUNCTION $change',
    async ({ change, initial, unsafe }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['postgres'], { level: 'all' }),
            'migrations/1_create.sql': `CREATE FUNCTION access() RETURNS int LANGUAGE sql ${initial} AS $$ SELECT 1 $$;`,
            'migrations/2_alter.sql': `ALTER FUNCTION access() ${change};`,
        });
        const findings = await runSandboxCheck(sandbox.path, 'postgres/definer-search-path');
        expect(findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual(
            unsafe ? [{ file: 'migrations/2_alter.sql', rule: 'definer-search-path' }] : [],
        );
    },
);
