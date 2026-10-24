import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { join, posix } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { runChecks } from '#cli/commands/check/run.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

import {
    GRANT_FILES,
    FROZEN_GRANTS,
    DEFINER_REPAIRS,
    ROW_SECURITY_SQL,
    DEFINER_FUNCTION_SQL,
    DEFINER_SEARCH_PATH_SQL,
    SECURED_ROW_SECURITY_SQL,
} from '#tests/config/checks/database/postgres/access.ts';

test('grants reports GRANT ALL in both direct and default privileges', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['postgres'], { level: 'all' }),
        'migrations/1_grants.sql':
            'GRANT ALL ON TABLE orders TO app_reader;\nALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO app_reader;\nALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO app_reader;\nALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM app_reader;\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'postgres/grants');
    expect(findings.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        { file: 'migrations/1_grants.sql', line: 1, rule: 'grant-all' },
        { file: 'migrations/1_grants.sql', line: 2, rule: 'grant-all' },
    ]);
});

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
    expect(await runSandboxCheck(sandbox.path, 'postgres/definer-search-path')).toMatchObject([
        { file: 'migrations/2_overload.sql', rule: 'definer-search-path' },
    ]);
});

test.each(['', 'app'])('grants in scope %j skip frozen migrations and report the newer ones', async (scope) => {
    const prefix = scope === '' ? '' : `${scope}/`;
    await using sandbox = await testdir(
        Object.fromEntries(Object.entries(GRANT_FILES).map(([path, text]) => [`${prefix}${path}`, text])),
    );
    for (const { through, files } of FROZEN_GRANTS) {
        await writeFile(
            join(sandbox.path, 'gspot.toml'),
            buildSandboxSettings(['postgres'], {
                level: 'all',
                scopes: [{ path: 'app', configurations: ['postgres'] }],
                tables: `[postgres]\nfrozen_through = "${through}"\n`,
            }),
        );

        const findings = await runSandboxCheck(sandbox.path, 'postgres/grants', { scope });
        expect(findings.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual(
            files.map((path) => ({ file: `${prefix}${path}`, line: 1, rule: 'grant-all' })),
        );
    }
});

test.each(['', 'app'])(
    'row security in scope %j reports a table without row level security and passes after the fix',
    async (scope) => {
        const path = posix.join(scope, 'migrations/1_tables.sql');
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['postgres'], {
                level: 'all',
                tables: '[postgres]\nclient_schemas = ["public"]\n',
                scopes: [{ path: 'app', configurations: ['postgres'] }],
            }),
            [path]: ROW_SECURITY_SQL,
        });

        expect(await runSandboxCheck(sandbox.path, 'postgres/row-level-security', { scope })).toMatchObject([
            { check: 'postgres/row-level-security', file: path, line: 1, column: 1, rule: 'row-security' },
        ]);
        await writeFile(join(sandbox.path, path), SECURED_ROW_SECURITY_SQL);

        expect(await runSandboxCheck(sandbox.path, 'postgres/row-level-security', { scope })).toStrictEqual([]);
    },
);

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
            message:
                'This SECURITY DEFINER function sets no search_path. Set an explicit search_path so callers cannot choose the objects it accesses.',
        }),
    ]);
    await writeFile(join(sandbox.path, path), DEFINER_SEARCH_PATH_SQL);
    expect(await runSandboxCheck(sandbox.path, 'postgres/definer-search-path')).toStrictEqual([]);
});

test('row security skips when no client schemas are selected', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['postgres']),
        'migrations/1_orders.sql': 'CREATE TABLE public.orders (id bigint PRIMARY KEY);\n',
    });
    const result = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['postgres/row-level-security'] }),
    );
    expect(result.report.checks).toMatchObject([
        { status: 'skipped', findings: [], note: 'needs the setting postgres.client_schemas' },
    ]);
});
