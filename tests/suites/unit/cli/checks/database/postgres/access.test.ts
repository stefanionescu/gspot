import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { join, posix } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { matchFields } from '#tests/setup/matchers.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

import {
    GRANT_FILES,
    FROZEN_GRANTS,
    ROW_SECURITY_SQL,
    DEFINER_FUNCTION_SQL,
    SECURED_ROW_SECURITY_SQL,
    PINNED_DEFINER_FUNCTION_SQL,
} from '#tests/config/checks/database/postgres/access.ts';

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
    await writeFile(join(sandbox.path, path), PINNED_DEFINER_FUNCTION_SQL);
    expect(await runSandboxCheck(sandbox.path, 'postgres/definer-search-path')).toStrictEqual([]);
});
