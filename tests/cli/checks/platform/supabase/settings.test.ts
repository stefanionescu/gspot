// The built-in Supabase checks on a test project, run in-process: each fires on its defect and accepts the correction.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import type { RunReport } from '#cli/types/execution/check.ts';

import {
    TEST_PATH_FILES,
    SECRET_KEY_READS,
    TEST_PATH_POLICY,
} from '#tests/config/cli/checks/platform/supabase/settings.ts';

test('service role keys use effective test paths while adjacent client files still fail', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': TEST_PATH_POLICY, ...TEST_PATH_FILES });
    const result = await runGspot(sandbox.path, ['check', '--only', 'supabase/service-role-key', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(1);
    const report = JSON.parse(result.stdout) as RunReport;
    expect(report.checks.flatMap(({ findings }) => findings.map(({ file, rule }) => ({ file, rule })))).toStrictEqual([
        { file: 'client.ts', rule: 'admin-key' },
        { file: 'apps/web/client.ts', rule: 'admin-key' },
    ]);
});

test('service role keys are refused in component and module clients while allowed server files remain untouched', async () => {
    await using sandbox = await testdir();
    const policy = buildPolicy(['supabase'], { tables: '[supabase]\nfunctions_folder = "server"\n' });
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
    await createFileTree(sandbox.path, { 'gspot.toml': policy, ...sources });
    const result = await runGspot(sandbox.path, ['check', '--only', 'supabase/service-role-key', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(1);
    const report = JSON.parse(result.stdout) as RunReport;
    expect(report.checks.flatMap(({ findings }) => findings.map(({ file }) => file))).toStrictEqual([
        'client.astro',
        'client.cjs',
        'client.cts',
        'client.mts',
        'client.svelte',
        'client.vue',
    ]);
    for (const [path, text] of Object.entries(sources)) {
        expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(text);
        if (path.startsWith('client.'))
            await Bun.write(
                join(sandbox.path, path),
                text.replaceAll('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY'),
            );
    }
    const corrected = await runGspot(sandbox.path, ['check', '--only', 'supabase/service-role-key', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks[0]?.findings).toStrictEqual([]);
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(policy);
    expect(await readFile(join(sandbox.path, 'server/allowed.ts'), 'utf8')).toBe(sources['server/allowed.ts']);
});

test.each(SECRET_KEY_READS)(
    'privileged Supabase keys reject %s in client scopes and preserve allowed files',
    async (read) => {
        await using sandbox = await testdir();
        const policy = buildPolicy(['supabase'], {
            tables: 'test_files = ["qa/**"]\n[supabase]\nfunctions_folder = "server"\n[scope."apps/web".supabase]\nfunctions_folder = "server"\n',
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
            'gspot.toml': policy,
            ...allowed,
            ...Object.fromEntries(clients.map((path) => [path, source])),
        });
        const command = ['check', '--only', 'supabase/service-role-key', '--json'];
        const failed = await runGspot(sandbox.path, command);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        expect(
            (JSON.parse(failed.stdout) as RunReport).checks
                .flatMap((check) => check.findings)
                .map(({ file, line, rule }) => ({ file, line, rule })),
        ).toStrictEqual(clients.map((file) => ({ file, line: 1, rule: 'admin-key' })));
        for (const path of clients)
            await Bun.write(join(sandbox.path, path), 'export const key = "sb_publishable_example";\n');
        const corrected = await runGspot(sandbox.path, command);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(
            await Promise.all(Object.keys(allowed).map((path) => Bun.file(join(sandbox.path, path)).text())),
        ).toStrictEqual(Object.values(allowed));
        expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(policy);
    },
);
