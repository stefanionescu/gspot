import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { BUILT_IN_CHECKS } from '#cli/checks/public.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { getKeptMode } from '#tests/harness/platforms.ts';
import { toolPin } from '#cli/configurations/contracts.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { levelSchema } from '#cli/parsers/schema/contracts.ts';
import { mockPinnedExecutables } from '#tests/harness/pins.ts';
import { functionFolders } from '#cli/checks/platform/public.ts';
import { stat, chmod, rename, readFile, writeFile } from 'node:fs/promises';
import { STORAGE_POLICIES } from '#tests/config/cli/checks/platform/supabase/configuration.ts';

test('Supabase configurations and function discovery stay within nested project scopes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['supabase'], {
            tables: '[scope."apps/api"]\nconfigurations = ["supabase"]\n[scope."apps/api".supabase]\nfunctions_folder = "edge"\n',
        }),
        'supabase/config.toml': '[functions.missing]\nverify_jwt = true\n',
        'supabase/functions/root/index.ts': 'export {};\n',
        'apps/api/supabase/config.toml': '[functions.hello]\nverify_jwt = true\n',
        'apps/api/edge/hello/index.ts': 'export {};\n',
        'apps/api/edge/_shared/index.ts': 'export {};\n',
    });
    const session = await openSession(sandbox.path);
    const root = buildCheckInput(session, 'supabase/project-file');
    const nested = buildCheckInput(session, 'supabase/project-file', { scope: 'apps/api' });
    expect(functionFolders(root)).toStrictEqual(['supabase/functions/root']);
    expect(functionFolders(nested)).toStrictEqual(['apps/api/edge/hello']);
    expect(BUILT_IN_CHECKS['supabase/project-file'].input(root)).toMatchObject([
        { file: 'supabase/config.toml', line: 1, rule: 'function' },
    ]);
    expect(BUILT_IN_CHECKS['supabase/project-file'].input(nested)).toStrictEqual([]);
    await writeFile(join(sandbox.path, 'supabase/config.toml'), '[functions.root]\nverify_jwt = true\n');
    expect(
        BUILT_IN_CHECKS['supabase/project-file'].input(
            buildCheckInput(await openSession(sandbox.path), 'supabase/project-file'),
        ),
    ).toStrictEqual([]);
});

test('Supabase malformed configuration reports syntax before storage analysis', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(['supabase'], { tables: '[scope."apps/api"]\n' }),
        'apps/api/supabase/config.toml': '[broken',
    });
    const broken = buildCheckInput(await openSession(sandbox.path), 'supabase/project-file', { scope: 'apps/api' });
    expect(BUILT_IN_CHECKS['supabase/project-file'].input(broken)).toMatchObject([
        { file: 'apps/api/supabase/config.toml', line: 1, rule: 'syntax' },
    ]);
    expect(await BUILT_IN_CHECKS['supabase/storage-policies'].input(broken)).toStrictEqual([]);
});

test('Supabase migration names are checked without parsing SQL or reading another scope', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['supabase'], {
            tables: '[scope."apps/api"]\nconfigurations = ["supabase"]\n',
        }),
        'supabase/migrations/20261005000000_valid.sql': 'CREATE TABLE ;',
        'apps/api/supabase/migrations/bad.sql': 'invalid SQL;',
    });
    const session = await openSession(sandbox.path);
    expect(
        BUILT_IN_CHECKS['supabase/migration-names'].input(buildCheckInput(session, 'supabase/migration-names')),
    ).toStrictEqual([]);
    expect(
        BUILT_IN_CHECKS['supabase/migration-names'].input(
            buildCheckInput(session, 'supabase/migration-names', { scope: 'apps/api' }),
        ),
    ).toMatchObject([
        {
            file: 'apps/api/supabase/migrations/bad.sql',
            rule: 'migration-name',
            message: 'Name the migration <14-digit timestamp>_<snake_case>.sql.',
        },
    ]);
    await rename(
        join(sandbox.path, 'apps/api/supabase/migrations/bad.sql'),
        join(sandbox.path, 'apps/api/supabase/migrations/20261005000001_valid.sql'),
    );
    expect(
        BUILT_IN_CHECKS['supabase/migration-names'].input(
            buildCheckInput(await openSession(sandbox.path), 'supabase/migration-names', { scope: 'apps/api' }),
        ),
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
        expect(
            await rejection(
                BUILT_IN_CHECKS['supabase/deno-lint'].input(buildCheckInput(session, 'supabase/deno-lint')),
            ),
        ).toBe('The project configuration is invalid.');
        expect(await Bun.file(join(sandbox.path, 'supabase/functions/greet/deno.json')).text()).toBe('{');
    },
);

test.each(STORAGE_POLICIES.flatMap((entry) => levelSchema.options.map((level) => ({ ...entry, level }))))(
    'storage policy $name retains native scope and literal boundaries at $level',
    async ({ sql, allowed, level }) => {
        await using sandbox = await testdir();
        const policy = buildPolicy(['supabase'], { level, tables: '[scope.app]\nconfigurations = ["supabase"]\n' });
        await createFileTree(sandbox.path, {
            'gspot.toml': policy,
            'supabase/config.toml': '[storage.buckets.avatars]\npublic = false\n',
            'supabase/migrations/20261005000000_policy.sql': sql,
            'app/supabase/config.toml': '[storage.buckets.avatars]\npublic = false\n',
            'app/supabase/migrations/20261005000000_policy.sql': sql,
        });
        for (const scope of ['', 'app']) {
            const path = join(scope, 'supabase/migrations/20261005000000_policy.sql');
            await chmod(join(sandbox.path, path), 0o600);
            const input = buildCheckInput(await openSession(sandbox.path), 'supabase/storage-policies', { scope });
            const findings = await BUILT_IN_CHECKS['supabase/storage-policies'].input(input);
            expect(findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual(
                allowed
                    ? []
                    : [
                          {
                              file: scope === '' ? 'supabase/config.toml' : 'app/supabase/config.toml',
                              rule: 'bucket-policy',
                          },
                      ],
            );
            expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(sql);
            const metadata = await stat(join(sandbox.path, path));
            expect(metadata.mode & 0o777).toBe(getKeptMode(0o600));
            await writeFile(
                join(sandbox.path, path),
                "CREATE POLICY p ON storage.objects USING (bucket_id = 'avatars');",
            );
            expect(
                await BUILT_IN_CHECKS['supabase/storage-policies'].input(
                    buildCheckInput(await openSession(sandbox.path), 'supabase/storage-policies', { scope }),
                ),
            ).toStrictEqual([]);
        }
        expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(policy);
    },
);

test('storage policy analysis retains the native malformed migration refusal', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(['supabase']),
        'supabase/config.toml': '[storage.buckets.avatars]\npublic = false\n',
        'supabase/migrations/20261005000000_policy.sql': 'CREATE POLICY ;',
    });
    const input = buildCheckInput(await openSession(sandbox.path), 'supabase/storage-policies');
    expect(await rejection(BUILT_IN_CHECKS['supabase/storage-policies'].input(input))).toContain(
        'supabase/migrations/20261005000000_policy.sql:1:',
    );
    expect(await readFile(join(sandbox.path, 'supabase/migrations/20261005000000_policy.sql'), 'utf8')).toBe(
        'CREATE POLICY ;',
    );
});
