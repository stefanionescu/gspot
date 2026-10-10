import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { stat, readFile, writeFile } from 'node:fs/promises';
import { BUILT_IN_CALCULATIONS } from '#cli/checks/public.ts';

import {
    RLS_SOURCE,
    GRANT_FILES,
    ACCESS_SCOPES,
    FROZEN_GRANTS,
} from '#tests/config/cli/checks/database/postgres/access.ts';

test.each([...ACCESS_SCOPES])(
    '$level grants in "$scope" omit frozen migrations and retain mutable findings',
    async ({ level, scope }) => {
        await using sandbox = await testdir();
        const prefix = scope === '' ? '' : `${scope}/`;
        for (const [path, text] of Object.entries(GRANT_FILES)) {
            await createFileTree(sandbox.path, { [`${prefix}${path}`]: text });
        }
        const modes = new Map(
            await Promise.all(
                Object.keys(GRANT_FILES).map(async (path) => {
                    const entry = await stat(join(sandbox.path, prefix, path));
                    return [path, entry.mode] as const;
                }),
            ),
        );
        for (const { through, files } of FROZEN_GRANTS) {
            await writeFile(
                join(sandbox.path, 'gspot.toml'),
                buildPolicy(['postgres'], {
                    level,
                    tables: `[postgres]\nfrozen_through = "${through}"\n[scope."app"]\nconfigurations = ["postgres"]\n`,
                }),
            );
            const input = buildCheckInput(await openSession(sandbox.path), 'postgres/grants', { scope });
            const findings = await BUILT_IN_CALCULATIONS['postgres/grants'](input);
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
        for (const [path, text] of Object.entries(GRANT_FILES)) {
            expect(await readFile(join(sandbox.path, prefix, path), 'utf8')).toBe(text);
            const entry = await stat(join(sandbox.path, prefix, path));
            expect(modes.get(path)).toBe(entry.mode);
        }
    },
);

test.each([...ACCESS_SCOPES])(
    '$level row security in "$scope" permits a server-only table and reports disabled RLS',
    async ({ level, scope }) => {
        await using sandbox = await testdir();
        const prefix = scope === '' ? '' : `${scope}/`;
        const path = `${prefix}migrations/1_tables.sql`;
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['postgres'], {
                level,
                tables: '[postgres]\nclient_schemas = ["public"]\n[scope."app"]\nconfigurations = ["postgres"]\n',
            }),
            [path]: RLS_SOURCE,
        });
        const input = buildCheckInput(await openSession(sandbox.path), 'postgres/rls', { scope });
        expect(await BUILT_IN_CALCULATIONS['postgres/rls'](input)).toStrictEqual([
            {
                check: 'postgres/rls',
                file: path,
                line: 1,
                column: 1,
                rule: 'row-security',
                fixable: false,
                message: 'public.private_data does not have row level security enabled.',
            },
        ]);
        await writeFile(join(sandbox.path, path), `${RLS_SOURCE}ALTER TABLE private_data ENABLE ROW LEVEL SECURITY;\n`);
        const corrected = buildCheckInput(await openSession(sandbox.path), 'postgres/rls', { scope });
        expect(await BUILT_IN_CALCULATIONS['postgres/rls'](corrected)).toStrictEqual([]);
    },
);
