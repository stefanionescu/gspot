import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { settingsText } from '#tests/setup/settings.ts';
import { checkFindings } from '#tests/setup/check-input.ts';
import { RLS_SOURCE, GRANT_FILES, FROZEN_GRANTS } from '#tests/config/postgres.ts';

test.each(['', 'app'])('grants in "$scope" skip frozen migrations and report the newer ones', async (scope) => {
    const level = 'all' as const;
    await using sandbox = await testdir();
    const prefix = scope === '' ? '' : `${scope}/`;
    for (const [path, text] of Object.entries(GRANT_FILES)) {
        await createFileTree(sandbox.path, { [`${prefix}${path}`]: text });
    }
    for (const { through, files } of FROZEN_GRANTS) {
        await writeFile(
            join(sandbox.path, 'gspot.toml'),
            settingsText(['postgres'], {
                level,
                tables: `[postgres]\nfrozen_through = "${through}"\n[[scope]]\npath = "app"\nconfigurations = ["postgres"]\n`,
            }),
        );

        const findings = await checkFindings(sandbox.path, 'postgres/grants', { scope });
        expect(findings.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual(
            files.map((path) => ({ file: `${prefix}${path}`, line: 1, rule: 'grant-all' })),
        );
        expect(
            findings.every(
                ({ message }) =>
                    message === 'GRANT ALL gives every privilege, present and future; name the privileges.',
            ),
        ).toBe(true);
    }
});

test.each(['', 'app'])(
    'row security in "$scope" reports a table without row level security and passes after the fix',
    async (scope) => {
        const level = 'all' as const;
        await using sandbox = await testdir();
        const prefix = scope === '' ? '' : `${scope}/`;
        const path = `${prefix}migrations/1_tables.sql`;
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText(['postgres'], {
                level,
                tables: '[postgres]\nclient_schemas = ["public"]\n[[scope]]\npath = "app"\nconfigurations = ["postgres"]\n',
            }),
            [path]: RLS_SOURCE,
        });

        expect(await checkFindings(sandbox.path, 'postgres/row-level-security', { scope })).toStrictEqual([
            {
                check: 'postgres/row-level-security',
                file: path,
                line: 1,
                column: 1,
                rule: 'row-security',
                help: 'Enable row level security on the table.',
                fixable: false,
                message: 'public.private_data does not have row level security enabled.',
            },
        ]);
        await writeFile(join(sandbox.path, path), `${RLS_SOURCE}ALTER TABLE private_data ENABLE ROW LEVEL SECURITY;\n`);

        expect(await checkFindings(sandbox.path, 'postgres/row-level-security', { scope })).toStrictEqual([]);
    },
);
