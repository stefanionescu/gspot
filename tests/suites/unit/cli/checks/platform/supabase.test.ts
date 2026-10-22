import { join, posix } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/system/processes.ts';
import { runChecks } from '#cli/commands/check/run.ts';
import { readTree } from '#tests/setup/system/files.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { runSandboxCheck, openPinnedSession } from '#tests/setup/cli/checks.ts';

import {
    SECRET_KEY_READS,
    STORAGE_POLICIES,
    SERVICE_KEY_READERS,
    SERVICE_KEY_SETTINGS,
    SERVICE_ROLE_CLIENTS,
    AVATARS_BUCKET_CONFIG,
    INVALID_BUCKETS_CONFIG,
    SERVICE_ROLE_CLIENT_FILES,
} from '#tests/config/checks/platform/supabase.ts';

test('supabase/deno-lint runs in each scope folder on each edge function of its functions folder, without _shared', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['supabase'], {
            scopes: [{ path: 'apps/api', configurations: ['supabase'] }],
            tables: '[scope.supabase]\nfunctions_folder = "apps/api/edge"\n',
        }),
        'supabase/functions/root/index.ts': 'export {};\n',
        'apps/api/edge/hello/index.ts': 'export {};\n',
        'apps/api/edge/_shared/index.ts': 'export {};\n',
    });

    using resources = new DisposableStack();
    const session = await openPinnedSession(sandbox.path, ['deno'], resources);
    using run = spyOn(processes, 'spawnProcess').mockResolvedValue(
        buildProcessResult({ stdout: '{"diagnostics":[],"errors":[]}' }),
    );
    expect(await runSandboxCheck(session.root, 'supabase/deno-lint', { scope: '' })).toStrictEqual([]);
    expect(await runSandboxCheck(session.root, 'supabase/deno-lint', { scope: 'apps/api' })).toStrictEqual([]);
    expect(run.mock.calls.map(([command, options]) => ({ cwd: options.cwd, target: command.at(-1) }))).toStrictEqual([
        { cwd: sandbox.path, target: join(sandbox.path, 'supabase/functions/root') },
        { cwd: join(sandbox.path, 'apps/api'), target: join(sandbox.path, 'apps/api/edge/hello') },
    ]);
});

test('supabase/storage-policies reports nothing for a config.toml with a TOML syntax error', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['supabase'], { scopes: [{ path: 'apps/api' }] }),
        'apps/api/supabase/config.toml': '[broken',
    });
    expect(await runSandboxCheck(sandbox.path, 'supabase/storage-policies', { scope: 'apps/api' })).toStrictEqual([]);
});

test.each([1, 2])(
    "supabase/deno-lint fails with Deno's error text when Deno exits %s without a JSON report",
    async (code) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['supabase']),
            'supabase/functions/greet/index.ts': 'export {};',
            'supabase/functions/greet/deno.json': '{',
        });

        using resources = new DisposableStack();
        const session = await openPinnedSession(sandbox.path, ['deno'], resources);
        resources.use(
            spyOn(processes, 'spawnProcess').mockResolvedValue(
                buildProcessResult({ code, stderr: 'The project configuration is invalid.' }),
            ),
        );
        expect(await captureRejection(runSandboxCheck(session.root, 'supabase/deno-lint'))).toBe(
            'The project configuration is invalid.',
        );
    },
);

test.each([...STORAGE_POLICIES])(
    "a storage policy counts only a real bucket_id = 'name' condition on storage.objects: $name",
    async ({ sql, allowed }) => {
        await using sandbox = await testdir();
        const settings = buildSandboxSettings(['supabase'], {
            level: 'all',
            scopes: [{ path: 'app', configurations: ['supabase'] }],
        });
        await createFileTree(sandbox.path, {
            'gspot.toml': settings,
            'supabase/config.toml': AVATARS_BUCKET_CONFIG,
            'supabase/migrations/20261005000000_policy.sql': sql,
            'app/supabase/config.toml': AVATARS_BUCKET_CONFIG,
            'app/supabase/migrations/20261005000000_policy.sql': sql,
        });
        for (const scope of ['', 'app']) {
            const path = join(scope, 'supabase/migrations/20261005000000_policy.sql');

            const findings = await runSandboxCheck(sandbox.path, 'supabase/storage-policies', { scope });
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
            await writeFile(
                join(sandbox.path, path),
                "CREATE POLICY p ON storage.objects USING (bucket_id = 'avatars');",
            );
            expect(await runSandboxCheck(sandbox.path, 'supabase/storage-policies', { scope })).toStrictEqual([]);
        }
    },
);

test("service role keys are allowed in each scope's test files and refused in client files", async () => {
    await using sandbox = await testdir({ 'gspot.toml': SERVICE_KEY_SETTINGS, ...SERVICE_KEY_READERS });

    const result = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['supabase/service-role-key'] }),
    );

    const report = result.report;
    expect(report.checks.flatMap(({ findings }) => findings.map(({ file, rule }) => ({ file, rule })))).toStrictEqual([
        { file: 'client.ts', rule: 'service-role-key' },
        { file: 'apps/web/client.ts', rule: 'service-role-key' },
    ]);
});

test('service role keys are refused in component and module clients and allowed in the functions folder', async () => {
    await using sandbox = await testdir();
    const settings = buildSandboxSettings(['supabase'], { tables: '[supabase]\nfunctions_folder = "server"\n' });
    const sources = SERVICE_ROLE_CLIENTS;
    await createFileTree(sandbox.path, { 'gspot.toml': settings, ...sources });
    const findings = await runSandboxCheck(sandbox.path, 'supabase/service-role-key');
    expect(findings.map(({ file }) => file)).toStrictEqual([...SERVICE_ROLE_CLIENT_FILES]);
    for (const [path, text] of Object.entries(sources)) {
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

test.each(['', 'apps/api'])(
    'supabase/storage-policies fails on a config.toml whose buckets value is not a table in scope %s',
    async (scope) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['supabase'], {
                tables: scope === '' ? '' : `[[scope]]\npath = "${scope}"\n`,
            }),
            [join(scope, 'supabase/config.toml')]: INVALID_BUCKETS_CONFIG,
        });
        const before = await readTree(sandbox.path);
        const session = await openSession(sandbox.path);
        using _resources = session.resources;
        const failed = await runChecks(session, buildRunOptions({ only: ['supabase/storage-policies'] }));

        const check = failed.report.checks.find((entry) => entry.scope === scope);
        expect(check).toMatchObject({ check: 'supabase/storage-policies', scope, status: 'error', findings: [] });
        expect(check?.note).toContain('expected record, received string');
        expect(check?.note).toContain('storage.buckets:');
        expect(check?.note).toContain(posix.join(scope, 'supabase/config.toml'));
        expect(await readTree(sandbox.path)).toStrictEqual(before);
    },
);

test('supabase/storage-policies reports nothing without a config.toml', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings(['supabase']) });
    expect(await runSandboxCheck(sandbox.path, 'supabase/storage-policies')).toStrictEqual([]);
});
