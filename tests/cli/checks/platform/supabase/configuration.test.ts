import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { renameSync, writeFileSync } from 'node:fs';
import { toolPin } from '#cli/configurations/pins.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { buildEngineInput } from '#tests/harness/input.ts';
import { rejection } from '#tests/harness/expectations.ts';
import type { ToolSession } from '#cli/types/tools/session.ts';
import { mockPinnedExecutables } from '#tests/harness/pins.ts';
import type { EngineInput } from '#cli/types/execution/check.ts';

import {
    denoLint,
    migrationNames,
    functionFolders,
    storagePolicies,
    supabaseConfiguration,
} from '#cli/checks/platform/supabase.ts';

function input(session: ToolSession, scope: string, name: string): EngineInput {
    const spec = session.manifests.get('supabase')!.checks.find((check) => check.name === name)!;
    return buildEngineInput(session, spec.name, { scope: scope });
}

test('Supabase configurations and function discovery stay within nested project scopes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['supabase'], {
            tables: '[[scope]]\npath = "apps/api"\nconfigurations = ["supabase"]\n[scope.supabase]\nfunctions_folder = "edge"\n',
        }),
        'supabase/config.toml': '[functions.missing]\nverify_jwt = true\n',
        'supabase/functions/root/index.ts': 'export {};\n',
        'apps/api/supabase/config.toml': '[functions.hello]\nverify_jwt = true\n',
        'apps/api/edge/hello/index.ts': 'export {};\n',
        'apps/api/edge/_shared/index.ts': 'export {};\n',
    });
    const session = await openSession(sandbox.path);
    const root = input(session, '', 'supabase/config');
    const nested = input(session, 'apps/api', 'supabase/config');
    expect(functionFolders(root)).toStrictEqual(['supabase/functions/root']);
    expect(functionFolders(nested)).toStrictEqual(['apps/api/edge/hello']);
    expect(supabaseConfiguration(root)).toMatchObject([{ file: 'supabase/config.toml', line: 1, rule: 'function' }]);
    expect(supabaseConfiguration(nested)).toStrictEqual([]);
    writeFileSync(join(sandbox.path, 'supabase/config.toml'), '[functions.root]\nverify_jwt = true\n');
    expect(supabaseConfiguration(input(await openSession(sandbox.path), '', 'supabase/config'))).toStrictEqual([]);
    writeFileSync(join(sandbox.path, 'apps/api/supabase/config.toml'), '[broken');
    const broken = input(await openSession(sandbox.path), 'apps/api', 'supabase/config');
    expect(supabaseConfiguration(broken)).toMatchObject([
        { file: 'apps/api/supabase/config.toml', line: 1, rule: 'syntax' },
    ]);
    expect(await storagePolicies(broken)).toStrictEqual([]);
});

test('Supabase migration names are checked without parsing SQL or reading another scope', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['supabase'], {
            tables: '[[scope]]\npath = "apps/api"\nconfigurations = ["supabase"]\n',
        }),
        'supabase/migrations/20261005000000_valid.sql': 'CREATE TABLE ;',
        'apps/api/supabase/migrations/bad.sql': 'invalid SQL;',
    });
    const session = await openSession(sandbox.path);
    expect(migrationNames(input(session, '', 'supabase/migration-names'))).toStrictEqual([]);
    expect(migrationNames(input(session, 'apps/api', 'supabase/migration-names'))).toMatchObject([
        {
            file: 'apps/api/supabase/migrations/bad.sql',
            rule: 'migration-name',
            message: 'Name the migration <14-digit timestamp>_<snake_case>.sql.',
        },
    ]);
    renameSync(
        join(sandbox.path, 'apps/api/supabase/migrations/bad.sql'),
        join(sandbox.path, 'apps/api/supabase/migrations/20261005000001_valid.sql'),
    );
    expect(
        migrationNames(input(await openSession(sandbox.path), 'apps/api', 'supabase/migration-names')),
    ).toStrictEqual([]);
});

test.each([1, 2])(
    'Deno lint exit %s without JSON reports the configuration diagnostic and preserves files',
    async (code) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['supabase']),
            'supabase/functions/greet/index.ts': 'export {};',
            'supabase/functions/greet/deno.json': '{',
        });
        const session = await openSession(sandbox.path);
        using resources = new DisposableStack();
        resources.use(mockPinnedExecutables([toolPin(session.manifests.values(), 'deno')]));
        resources.use(
            spyOn(processes, 'run').mockResolvedValue({
                code,
                stdout: '',
                stderr: 'The project configuration is invalid.',
                missing: false,
                duration: 1,
            }),
        );
        expect(await rejection(denoLint(input(session, '', 'supabase/deno-lint')))).toBe(
            'The project configuration is invalid.',
        );
        expect(await Bun.file(join(sandbox.path, 'supabase/functions/greet/deno.json')).text()).toBe('{');
    },
);
