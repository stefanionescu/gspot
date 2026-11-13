import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { expect, test } from 'bun:test';

import { runChecks } from '#cli/engine/run/checks.ts';
import { openSession } from '#cli/engine/session.ts';
import {
    AVATARS_BUCKET_CONFIG,
    SERVICE_KEY_SETTINGS,
    STORAGE_POLICIES,
} from '#tests/config/configurations/platform.ts';
import { openFakeToolSession, runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { listFindingRows } from '#tests/setup/cli/commands.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { fakeCommands } from '#tests/setup/system/fakes.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';

async function prepareDenoSession(root: string) {
    using resources = new DisposableStack();
    const session = await openFakeToolSession(root, ['deno'], resources);
    const run = resources.use(
        fakeCommands().mockResolvedValue(buildProcessResult({ stdout: '{"diagnostics":[],"errors":[]}' })),
    );
    const owned = resources.move();
    return { session, run, [Symbol.dispose]: owned[Symbol.dispose].bind(owned) };
}

test('supabase/storage-policies reports a syntax finding for malformed TOML', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['supabase'], { scopes: [{ path: 'apps/api' }] }),
        'apps/api/supabase/config.toml': '[broken',
    });
    expect(await runSandboxCheck(sandbox.path, 'supabase/storage-policies', { scope: 'apps/api' })).toStrictEqual([
        expect.objectContaining({ file: 'apps/api/supabase/config.toml', line: 1, rule: 'syntax' }),
    ]);
});

test.each([...STORAGE_POLICIES])(
    "a storage policy counts a bucket_id = 'name' condition on storage.objects, not a lookalike: $name",
    async ({ sql, allowed }) => {
        const path = 'supabase/migrations/20261005000000_policy.sql';
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['supabase'], { level: 'all' }),
            'supabase/config.toml': AVATARS_BUCKET_CONFIG,
            [path]: sql,
        });
        const findings = await runSandboxCheck(sandbox.path, 'supabase/storage-policies');
        expect(findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual(
            allowed ? [] : [{ file: 'supabase/config.toml', rule: 'bucket-policy' }],
        );
    },
);

test("service role keys are allowed in each scope's test files and refused in client files", async () => {
    const reader = 'export const key = process.env.SUPABASE_SERVICE_ROLE_KEY;\n';
    await using sandbox = await createGitSandbox({
        'gspot.toml': SERVICE_KEY_SETTINGS,
        'qa/entry.ts': reader,
        'tests/default.ts': reader,
        'client.ts': reader,
        'apps/web/verification/entry.ts': reader,
        'apps/web/qa/entry.ts': reader,
        'apps/web/client.ts': reader,
    });

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
    const settings = buildSandboxSettings(['supabase'], { tables: '[supabase]\nfunctions_folder = "server"\n' });
    await using sandbox = await createGitSandbox({
        'gspot.toml': settings,
        'client.vue': '<script setup>const key = process.env.SUPABASE_SERVICE_ROLE_KEY;</script>\n',
        'client.mts': 'export const key = process.env.SUPABASE_SERVICE_ROLE_KEY;\n',
        'server/allowed.ts': 'export const key = process.env.SUPABASE_SERVICE_ROLE_KEY;\n',
        'notes.txt': 'SUPABASE_SERVICE_ROLE_KEY\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'supabase/service-role-key');
    expect(findings.map(({ file }) => file)).toStrictEqual(['client.mts', 'client.vue']);
});

test('a secret Supabase key is refused in client files', async () => {
    const settings = buildSandboxSettings(['supabase'], {
        tables: 'test_files = ["qa/**"]\n[supabase]\nfunctions_folder = "server"\n[[scope]]\npath = "apps/web"\nconfigurations = ["supabase"]\n[scope.supabase]\nfunctions_folder = "server"\n',
    });
    const source = 'export const key = "sb_secret_example";\n';
    const allowed = {
        'server/admin.ts': source,
        'qa/admin.ts': source,
        'apps/web/server/admin.ts': source,
        'publishable.ts': 'export const key = "sb_publishable_example";\n',
    };
    const clients = ['client.ts', 'apps/web/client.ts'];
    await using sandbox = await createGitSandbox({
        'gspot.toml': settings,
        ...allowed,
        ...Object.fromEntries(clients.map((path) => [path, source])),
    });

    const failed = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['supabase/service-role-key'] }),
    );

    expect(listFindingRows(failed.report)).toStrictEqual(
        clients.map((file) => ({ file, line: 1, rule: 'service-role-key' })),
    );
});

test('supabase/verify-jwt reports verify_jwt = false without a comment on its line', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['supabase']),
        'supabase/config.toml':
            '[functions.webhook]\nverify_jwt = false\n\n[functions.hook]\nverify_jwt = false # A signed webhook.\n\n[functions.user]\nverify_jwt = true\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'supabase/verify-jwt');
    expect(findings.map(({ rule, line }) => ({ rule, line }))).toStrictEqual([{ rule: 'verify-jwt', line: 2 }]);
});

test('a node script without an extension that reads the service role key is reported', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['supabase']),
        'bin/admin': '#!/usr/bin/env node\nconsole.log(process.env.SUPABASE_SERVICE_ROLE_KEY);\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'supabase/service-role-key');
    expect(findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
        { file: 'bin/admin', rule: 'service-role-key' },
    ]);
});

test('supabase/deno-lint runs in each scope folder on each edge function of its functions folder, without _shared', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['supabase'], {
            scopes: [{ path: 'apps/api', configurations: ['supabase'] }],
            tables: '[scope.supabase]\nfunctions_folder = "edge"\n',
        }),
        'supabase/functions/root/index.ts': 'export {};\n',
        'apps/api/edge/hello/index.ts': 'export {};\n',
        'apps/api/edge/_shared/index.ts': 'export {};\n',
    });

    using deno = await prepareDenoSession(sandbox.path);
    const { session, run } = deno;
    expect(await runSandboxCheck(session.root, 'supabase/deno-lint', { scope: '' })).toStrictEqual([]);
    expect(await runSandboxCheck(session.root, 'supabase/deno-lint', { scope: 'apps/api' })).toStrictEqual([]);
    expect(run.mock.calls.map(([command, options]) => ({ cwd: options.cwd, target: command.at(-1) }))).toStrictEqual([
        { cwd: sandbox.path, target: join(sandbox.path, 'supabase/functions/root') },
        { cwd: join(sandbox.path, 'apps/api'), target: join(sandbox.path, 'apps/api/edge/hello') },
    ]);
});

test("supabase/deno-lint fails with Deno's error text when Deno exits without a JSON report", async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['supabase']),
        'supabase/functions/greet/index.ts': 'export {};',
        'supabase/functions/greet/deno.json': '{',
    });

    using resources = new DisposableStack();
    const session = await openFakeToolSession(sandbox.path, ['deno'], resources);
    resources.use(
        fakeCommands().mockResolvedValue(
            buildProcessResult({ code: 1, stderr: 'The project configuration is invalid.' }),
        ),
    );
    const error = await captureRejection(runSandboxCheck(session.root, 'supabase/deno-lint'));
    expect(error.message).toBe('The project configuration is invalid.');
});

test('a configured edge entrypoint and import map reach Deno, unless deno.json takes precedence', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['supabase']),
        'supabase/config.toml':
            '[functions.greet]\nentrypoint = "./functions/greet/main.ts"\nimport_map = "./imports.json"\n',
        'supabase/functions/greet/main.ts': 'export {};',
        'supabase/imports.json': '{}',
    });
    using deno = await prepareDenoSession(sandbox.path);
    const { session, run } = deno;
    expect(await runSandboxCheck(session.root, 'supabase/deno-lint')).toStrictEqual([]);
    expect(run.mock.calls.at(-1)?.[0]).toContain(join(sandbox.path, 'supabase/functions/greet'));
    expect(run.mock.calls.at(-1)?.[0]).toContain('--import-map');
    expect(run.mock.calls.at(-1)?.[0]).toContain(join(sandbox.path, 'supabase/imports.json'));
    await writeFile(join(sandbox.path, 'supabase/functions/greet/deno.json'), '{}');
    expect(await runSandboxCheck(session.root, 'supabase/deno-check')).toStrictEqual([]);
    expect(run.mock.calls.at(-1)?.[0]).toContain(join(sandbox.path, 'supabase/functions/greet/main.ts'));
    expect(run.mock.calls.at(-1)?.[0]).toContain('--config');
    expect(run.mock.calls.at(-1)?.[0]).not.toContain('--import-map');
});

test('Deno checks skip a scope with no edge functions', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['supabase']),
        'supabase/config.toml': '',
    });
    using resources = new DisposableStack();
    const session = await openFakeToolSession(sandbox.path, ['deno'], resources);
    const lint = await runChecks(session, buildRunOptions({ only: ['supabase/deno-lint'] }));
    expect(lint.report.checks).toStrictEqual([]);
    const typeCheck = await runChecks(session, buildRunOptions({ only: ['supabase/deno-check'] }));
    expect(typeCheck.report.checks[0]).toMatchObject({
        status: 'skipped',
        note: expect.stringContaining('supabase/functions') as string,
    });
});

test('Deno type errors use their location or the entrypoint', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['supabase']),
        'supabase/functions/greet/index.ts': 'export {};\n',
        'supabase/functions/greet/deno.json': '{}\n',
        'supabase/functions/plain/index.ts': 'export {};\n',
    });
    using resources = new DisposableStack();
    await openFakeToolSession(sandbox.path, ['deno'], resources);
    const location = pathToFileURL(join(sandbox.path, 'supabase/functions/greet/util.ts')).href;
    const entrypoint = join('greet', 'index.ts');
    resources.use(
        fakeCommands().mockImplementation((command) =>
            Promise.resolve(
                buildProcessResult({
                    code: 1,
                    stderr:
                        command.at(-1)?.includes(entrypoint) === true
                            ? `\u{1B}[31merror\u{1B}[0m: TS2322 [ERROR]: Type mismatch.\n    at ${location}:4:7\n`
                            : 'error: Module not found "./missing.ts".\n',
                }),
            ),
        ),
    );
    const findings = await runSandboxCheck(sandbox.path, 'supabase/deno-check');
    expect(findings.map(({ file, line, rule, message }) => ({ file, line, rule, message }))).toStrictEqual([
        {
            file: 'supabase/functions/greet/util.ts',
            line: 4,
            rule: 'type-error',
            message: 'error: TS2322 [ERROR]: Type mismatch.',
        },
        {
            file: 'supabase/functions/plain/index.ts',
            line: 1,
            rule: 'type-error',
            message: 'error: Module not found "./missing.ts".',
        },
    ]);
});

test('a deno lint error entry becomes a syntax finding at its repository path', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['supabase']),
        'supabase/functions/greet/index.ts': 'export {};\n',
    });
    using deno = await prepareDenoSession(sandbox.path);
    const entry = join(sandbox.path, 'supabase/functions/greet/index.ts');
    deno.run.mockResolvedValue(
        buildProcessResult({
            code: 1,
            stdout: JSON.stringify({ diagnostics: [], errors: [{ file_path: entry, message: 'Unexpected token.' }] }),
        }),
    );
    const findings = await runSandboxCheck(sandbox.path, 'supabase/deno-lint');
    expect(findings.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        { file: 'supabase/functions/greet/index.ts', line: 1, rule: 'syntax' },
    ]);
});
