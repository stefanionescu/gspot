import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { readTree } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/system/processes.ts';
import { runChecks } from '#cli/commands/check/run.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { buildRunOptions, buildProcessResult } from '#tests/setup/builders.ts';
import { checkFindings, openPinnedSession } from '#tests/setup/check-input.ts';

import {
    SECRET_KEY_READS,
    STORAGE_POLICIES,
    SERVICE_KEY_READERS,
    SERVICE_KEY_SETTINGS,
    AVATARS_BUCKET_CONFIG,
    INVALID_BUCKETS_CONFIG,
} from '#tests/data/checks/supabase.ts';

test('Supabase config.toml and function folders are read per scope', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['supabase'], {
            scopes: [{ path: 'apps/api', configurations: ['supabase'] }],
            tables: '[scope.supabase]\nfunctions_folder = "apps/api/edge"\n',
        }),
        'supabase/config.toml': '[functions.missing]\nverify_jwt = true\n',
        'supabase/functions/root/index.ts': 'export {};\n',
        'apps/api/supabase/config.toml': '[functions.hello]\nverify_jwt = true\n',
        'apps/api/edge/hello/index.ts': 'export {};\n',
        'apps/api/edge/_shared/index.ts': 'export {};\n',
    });

    using resources = new DisposableStack();
    const session = await openPinnedSession(sandbox.path, ['deno'], resources);
    using run = spyOn(processes, 'spawnProcess').mockResolvedValue(
        buildProcessResult({ stdout: '{"diagnostics":[],"errors":[]}' }),
    );
    for (const [scope, expected] of [
        ['', 'supabase/functions/root'],
        ['apps/api', 'apps/api/edge/hello'],
    ]) {
        expect(await checkFindings(session.root, 'supabase/deno-lint', { scope: scope! })).toStrictEqual([]);
        expect(run.mock.calls.at(-1)?.[1].cwd).toBe(join(sandbox.path, scope!));
        expect(run.mock.calls.at(-1)?.[0].at(-1)).toBe(join(sandbox.path, expected!));
    }
});

test('supabase/storage-policies reports nothing for a config.toml with a TOML syntax error', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['supabase'], { scopes: [{ path: 'apps/api' }] }),
        'apps/api/supabase/config.toml': '[broken',
    });
    expect(await checkFindings(sandbox.path, 'supabase/storage-policies', { scope: 'apps/api' })).toStrictEqual([]);
});

test.each([1, 2])("Deno lint exit %s without JSON reports Deno's error text", async (code) => {
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
    expect(await captureRejection(checkFindings(session.root, 'supabase/deno-lint'))).toBe(
        'The project configuration is invalid.',
    );
});

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

            const findings = await checkFindings(sandbox.path, 'supabase/storage-policies', { scope });
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
            expect(await checkFindings(sandbox.path, 'supabase/storage-policies', { scope })).toStrictEqual([]);
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
    const sources = {
        'client.vue': '<script setup>const key = process.env.SUPABASE_SERVICE_ROLE_KEY;</script>\n',
        'client.svelte': '<script>const key = process.env.SUPABASE_SERVICE_ROLE_KEY;</script>\n',
        'client.astro': '---\nconst key = process.env.SUPABASE_SERVICE_ROLE_KEY;\n---\n',
        'client.mts': 'export const key = process.env.SUPABASE_SERVICE_ROLE_KEY;\n',
        'client.cts': 'export const key = process.env.SUPABASE_SERVICE_ROLE_KEY;\n',
        'client.cjs': 'exports.key = process.env.SUPABASE_SERVICE_ROLE_KEY;\n',
        'server/allowed.ts': 'export const key = process.env.SUPABASE_SERVICE_ROLE_KEY;\n',
        'notes.txt': 'SUPABASE_SERVICE_ROLE_KEY\n',
    };
    await createFileTree(sandbox.path, { 'gspot.toml': settings, ...sources });
    const findings = await checkFindings(sandbox.path, 'supabase/service-role-key');
    expect(findings.map(({ file }) => file)).toStrictEqual([
        'client.astro',
        'client.cjs',
        'client.cts',
        'client.mts',
        'client.svelte',
        'client.vue',
    ]);
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
        expect(check?.note).toContain(join(scope, 'supabase/config.toml'));
        expect(await readTree(sandbox.path)).toStrictEqual(before);
    },
);

test('supabase/storage-policies reports nothing without a config.toml', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings(['supabase']) });
    expect(await checkFindings(sandbox.path, 'supabase/storage-policies')).toStrictEqual([]);
});
