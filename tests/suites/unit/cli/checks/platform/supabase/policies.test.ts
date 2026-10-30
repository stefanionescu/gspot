import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { runChecks } from '#cli/commands/check/run.ts';
import { openSession } from '#cli/planning/session.ts';
import { readTree } from '#tests/setup/system/files.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

import {
    SECRET_KEY_READS,
    STORAGE_POLICIES,
    SERVICE_KEY_READERS,
    SERVICE_KEY_SETTINGS,
    SERVICE_ROLE_CLIENTS,
    AVATARS_BUCKET_CONFIG,
    SERVICE_ROLE_CLIENT_FILES,
} from '#tests/config/checks/platform/supabase.ts';

test('supabase/storage-policies reports a syntax finding for malformed TOML', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['supabase'], { scopes: [{ path: 'apps/api' }] }),
        'apps/api/supabase/config.toml': '[broken',
    });
    expect(await runSandboxCheck(sandbox.path, 'supabase/storage-policies', { scope: 'apps/api' })).toStrictEqual([
        {
            check: 'supabase/storage-policies',
            file: 'apps/api/supabase/config.toml',
            line: 1,
            rule: 'syntax',
            message:
                'apps/api/supabase/config.toml:1:8 is not valid TOML: Expected table closing "]", found end of file. Fix the file.',
            fixable: false,
            help: 'Add a policy on storage.objects for the bucket in a migration.',
        },
    ]);
});

test.each([...STORAGE_POLICIES])(
    "a storage policy counts a bucket_id = 'name' condition on storage.objects, not a lookalike: $name",
    async ({ sql, allowed }) => {
        const path = 'supabase/migrations/20261005000000_policy.sql';
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['supabase'], { level: 'all' }),
            'supabase/config.toml': AVATARS_BUCKET_CONFIG,
            [path]: sql,
        });
        const findings = await runSandboxCheck(sandbox.path, 'supabase/storage-policies');
        expect(findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual(
            allowed ? [] : [{ file: 'supabase/config.toml', rule: 'bucket-policy' }],
        );
        await writeFile(join(sandbox.path, path), "CREATE POLICY p ON storage.objects USING (bucket_id = 'avatars');");
        expect(await runSandboxCheck(sandbox.path, 'supabase/storage-policies')).toStrictEqual([]);
    },
);

test("service role keys are allowed in each scope's test files and refused in client files", async () => {
    await using sandbox = await testdir({ 'gspot.toml': SERVICE_KEY_SETTINGS, ...SERVICE_KEY_READERS });

    const result = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['supabase/service-role-key'] }),
    );

    expect(
        result.report.checks.flatMap(({ findings }) => findings.map(({ file, rule }) => ({ file, rule }))),
    ).toStrictEqual([
        { file: 'client.ts', rule: 'service-role-key' },
        { file: 'tests/default.ts', rule: 'service-role-key' },
        { file: 'apps/web/client.ts', rule: 'service-role-key' },
    ]);
});

test('service role keys are refused in component and module clients and allowed in the functions folder', async () => {
    await using sandbox = await testdir();
    const settings = buildSandboxSettings(['supabase'], { tables: '[supabase]\nfunctions_folder = "server"\n' });
    await createFileTree(sandbox.path, { 'gspot.toml': settings, ...SERVICE_ROLE_CLIENTS });
    const findings = await runSandboxCheck(sandbox.path, 'supabase/service-role-key');
    expect(findings.map(({ file }) => file)).toStrictEqual([...SERVICE_ROLE_CLIENT_FILES]);
    for (const [path, text] of Object.entries(SERVICE_ROLE_CLIENTS)) {
        if (path.startsWith('client.'))
            await writeFile(
                join(sandbox.path, path),
                text.replaceAll('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY'),
            );
    }
    const corrected = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['supabase/service-role-key'] }),
    );

    expect(corrected.report.checks[0]?.findings).toStrictEqual([]);
});

test.each([...SECRET_KEY_READS])('a secret Supabase key read as %s is refused in client files', async (read) => {
    await using sandbox = await testdir();
    const settings = buildSandboxSettings(['supabase'], {
        tables: 'test_files = ["qa/**"]\n[supabase]\nfunctions_folder = "server"\n[[scope]]\npath = "apps/web"\nconfigurations = ["supabase"]\n[scope.supabase]\nfunctions_folder = "apps/web/server"\n',
    });
    const source = `export const key = ${read};\n`;
    const allowed = {
        'server/admin.ts': source,
        'qa/admin.ts': source,
        'apps/web/server/admin.ts': source,
        'publishable.ts': 'export const key = "sb_publishable_example";\n',
    };
    const clients = ['client.ts', 'apps/web/client.ts'];
    await createFileTree(sandbox.path, {
        'gspot.toml': settings,
        ...allowed,
        ...Object.fromEntries(clients.map((path) => [path, source])),
    });

    const failed = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['supabase/service-role-key'] }),
    );

    expect(
        failed.report.checks.flatMap((check) => check.findings).map(({ file, line, rule }) => ({ file, line, rule })),
    ).toStrictEqual(clients.map((file) => ({ file, line: 1, rule: 'service-role-key' })));
    for (const path of clients)
        await writeFile(join(sandbox.path, path), 'export const key = "sb_publishable_example";\n');
    const corrected = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['supabase/service-role-key'] }),
    );
    expect(corrected.report.failed).toStrictEqual([]);
});

test('supabase/storage-policies reports invalid bucket settings as a syntax finding', async () => {
    const path = 'supabase/config.toml';
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['supabase']),
        [path]: '[storage]\nbuckets = "avatars"\n',
    });
    const before = await readTree(sandbox.path);
    const session = await openSession(sandbox.path);
    using _resources = session.resources;
    const failed = await runChecks(session, buildRunOptions({ only: ['supabase/storage-policies'] }));

    expect(failed.report.checks).toMatchObject([
        {
            check: 'supabase/storage-policies',
            status: 'failed',
            findings: [
                {
                    file: path,
                    line: 1,
                    rule: 'syntax',
                    message: `${path}: storage.buckets: Invalid input: expected record, received string. Fix the field.`,
                },
            ],
        },
    ]);
    expect(failed.report.exitCode).toBe(1);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('supabase/storage-policies reports nothing without a config.toml', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings(['supabase']) });
    expect(await runSandboxCheck(sandbox.path, 'supabase/storage-policies')).toStrictEqual([]);
});
