import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { rejection } from '#tests/setup/matchers.ts';
import * as processes from '#cli/system/processes.ts';
import { openSession } from '#cli/commands/session.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { processResult } from '#tests/setup/processes.ts';
import { checkFindings } from '#tests/setup/check-input.ts';
import { mockPinnedExecutables } from '#tests/setup/pins.ts';
import { runGspot, checkReport } from '#tests/setup/run-gspot.ts';
import { toolDeclaration } from '#cli/configurations/tool-pins.ts';

import {
    SECRET_KEY_READS,
    STORAGE_POLICIES,
    SERVICE_KEY_READERS,
    SERVICE_KEY_SETTINGS,
} from '#tests/config/supabase.ts';

test('Supabase config.toml and function folders are read per scope', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['supabase'], {
            tables: '[[scope]]\npath = "apps/api"\nconfigurations = ["supabase"]\n[scope.supabase]\nfunctions_folder = "apps/api/edge"\n',
        }),
        'supabase/config.toml': '[functions.missing]\nverify_jwt = true\n',
        'supabase/functions/root/index.ts': 'export {};\n',
        'apps/api/supabase/config.toml': '[functions.hello]\nverify_jwt = true\n',
        'apps/api/edge/hello/index.ts': 'export {};\n',
        'apps/api/edge/_shared/index.ts': 'export {};\n',
    });
    const session = await openSession(sandbox.path);
    using _pins = mockPinnedExecutables([toolDeclaration(session.manifests.values(), 'deno')]);
    using run = spyOn(processes, 'spawnProcess').mockResolvedValue(
        processResult({ stdout: '{"diagnostics":[],"errors":[]}' }),
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

test('storage analysis skips a malformed config.toml', async () => {
    await using sandbox = await testdir({
        'gspot.toml': settingsText(['supabase'], { tables: '[[scope]]\npath = "apps/api"\n' }),
        'apps/api/supabase/config.toml': '[broken',
    });
    expect(await checkFindings(sandbox.path, 'supabase/storage-policies', { scope: 'apps/api' })).toStrictEqual([]);
});

test.each([1, 2])("Deno lint exit %s without JSON reports Deno's error text", async (code) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['supabase']),
        'supabase/functions/greet/index.ts': 'export {};',
        'supabase/functions/greet/deno.json': '{',
    });
    const session = await openSession(sandbox.path);
    using resources = new DisposableStack();
    resources.use(mockPinnedExecutables([toolDeclaration(session.manifests.values(), 'deno')]));
    resources.use(
        spyOn(processes, 'spawnProcess').mockResolvedValue(
            processResult({ code, stderr: 'The project configuration is invalid.' }),
        ),
    );
    expect(await rejection(checkFindings(session.root, 'supabase/deno-lint'))).toBe(
        'The project configuration is invalid.',
    );
});

test.each([...STORAGE_POLICIES])(
    "a storage policy counts only a real bucket_id = 'name' condition on storage.objects: $name",
    async ({ sql, allowed }) => {
        await using sandbox = await testdir();
        const settings = settingsText(['supabase'], {
            level: 'all',
            tables: '[[scope]]\npath = "app"\nconfigurations = ["supabase"]\n',
        });
        await createFileTree(sandbox.path, {
            'gspot.toml': settings,
            'supabase/config.toml': '[storage.buckets.avatars]\npublic = false\n',
            'supabase/migrations/20261005000000_policy.sql': sql,
            'app/supabase/config.toml': '[storage.buckets.avatars]\npublic = false\n',
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
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': SERVICE_KEY_SETTINGS, ...SERVICE_KEY_READERS });
    const result = await checkReport(sandbox.path, ['check', '--only', 'supabase/service-role-key', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(1);
    const report = result.report;
    expect(report.checks.flatMap(({ findings }) => findings.map(({ file, rule }) => ({ file, rule })))).toStrictEqual([
        { file: 'client.ts', rule: 'admin-key' },
        { file: 'apps/web/client.ts', rule: 'admin-key' },
    ]);
});

test('service role keys are refused in component and module clients and allowed in the functions folder', async () => {
    await using sandbox = await testdir();
    const settings = settingsText(['supabase'], { tables: '[supabase]\nfunctions_folder = "server"\n' });
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
    const result = await checkReport(sandbox.path, ['check', '--only', 'supabase/service-role-key', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(1);
    const report = result.report;
    expect(report.checks.flatMap(({ findings }) => findings.map(({ file }) => file))).toStrictEqual([
        'client.astro',
        'client.cjs',
        'client.cts',
        'client.mts',
        'client.svelte',
        'client.vue',
    ]);
    for (const [path, text] of Object.entries(sources)) {
        if (path.startsWith('client.'))
            await Bun.write(
                join(sandbox.path, path),
                text.replaceAll('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY'),
            );
    }
    const corrected = await checkReport(sandbox.path, ['check', '--only', 'supabase/service-role-key', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks[0]?.findings).toStrictEqual([]);
});

test.each([...SECRET_KEY_READS])('a secret Supabase key read as %s is refused in client files', async (read) => {
    await using sandbox = await testdir();
    const settings = settingsText(['supabase'], {
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
    const command = ['check', '--only', 'supabase/service-role-key', '--json'];
    const failed = await checkReport(sandbox.path, command);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(
        failed.report.checks.flatMap((check) => check.findings).map(({ file, line, rule }) => ({ file, line, rule })),
    ).toStrictEqual(clients.map((file) => ({ file, line: 1, rule: 'admin-key' })));
    for (const path of clients)
        await Bun.write(join(sandbox.path, path), 'export const key = "sb_publishable_example";\n');
    const corrected = await runGspot(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});
