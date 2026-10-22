import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { matchFields } from '#tests/setup/matchers.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

import {
    GRANT_FILES,
    FROZEN_GRANTS,
    ROW_SECURITY_SQL,
    DEFINER_FUNCTION_SQL,
    PINNED_DEFINER_FUNCTION_SQL,
} from '#tests/data/checks/postgres/access.ts';

test.each(['', 'app'])('grants in scope %j skip frozen migrations and report the newer ones', async (scope) => {
    const level = 'all' as const;
    await using sandbox = await testdir();
    const prefix = scope === '' ? '' : `${scope}/`;
    for (const [path, text] of Object.entries(GRANT_FILES)) {
        await createFileTree(sandbox.path, { [`${prefix}${path}`]: text });
    }
    for (const { through, files } of FROZEN_GRANTS) {
        await writeFile(
            join(sandbox.path, 'gspot.toml'),
            buildSandboxSettings(['postgres'], {
                level,
                tables: `[postgres]\nfrozen_through = "${through}"\n[[scope]]\npath = "app"\nconfigurations = ["postgres"]\n`,
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
        const level = 'all' as const;
        await using sandbox = await testdir();
        const prefix = scope === '' ? '' : `${scope}/`;
        const path = `${prefix}migrations/1_tables.sql`;
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSandboxSettings(['postgres'], {
                level,
                tables: '[postgres]\nclient_schemas = ["public"]\n',
                scopes: [{ path: 'app', configurations: ['postgres'] }],
            }),
            [path]: ROW_SECURITY_SQL,
        });

        expect(await runSandboxCheck(sandbox.path, 'postgres/row-level-security', { scope })).toMatchObject([
            { check: 'postgres/row-level-security', file: path, line: 1, column: 1, rule: 'row-security' },
        ]);
        await writeFile(
            join(sandbox.path, path),
            `${ROW_SECURITY_SQL}ALTER TABLE private_data ENABLE ROW LEVEL SECURITY;\n`,
        );

        expect(await runSandboxCheck(sandbox.path, 'postgres/row-level-security', { scope })).toStrictEqual([]);
    },
);

test('definer-search-path reports a SECURITY DEFINER function without search_path and passes once it sets one', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['postgres'], { level: 'all' }),
        'migrations/1_access.sql': DEFINER_FUNCTION_SQL,
    });
    expect(await runSandboxCheck(sandbox.path, 'postgres/definer-search-path')).toStrictEqual([
        matchFields({
            file: 'migrations/1_access.sql',
            line: 1,
            rule: 'definer-search-path',
            message:
                'This SECURITY DEFINER function sets no search_path. Set an explicit search_path so callers cannot choose the objects it accesses.',
        }),
    ]);
    await writeFile(join(sandbox.path, 'migrations/1_access.sql'), PINNED_DEFINER_FUNCTION_SQL);
    expect(await runSandboxCheck(sandbox.path, 'postgres/definer-search-path')).toStrictEqual([]);
});
