import { join } from 'node:path';
import { testdir } from 'testdirs';
import { pathToFileURL } from 'node:url';
import { writeFile } from 'node:fs/promises';
import { test, spyOn, expect } from 'bun:test';
import * as processes from '#cli/system/processes.ts';
import { runChecks } from '#cli/commands/check/run.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { runSandboxCheck, openFakeToolSession } from '#tests/setup/cli/checks.ts';

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

    using deno = await prepareDenoSession(sandbox.path);
    const { session, run } = deno;
    expect(await runSandboxCheck(session.root, 'supabase/deno-lint', { scope: '' })).toStrictEqual([]);
    expect(await runSandboxCheck(session.root, 'supabase/deno-lint', { scope: 'apps/api' })).toStrictEqual([]);
    expect(run.mock.calls.map(([command, options]) => ({ cwd: options.cwd, target: command.at(-1) }))).toStrictEqual([
        { cwd: sandbox.path, target: join(sandbox.path, 'supabase/functions/root') },
        { cwd: join(sandbox.path, 'apps/api'), target: join(sandbox.path, 'apps/api/edge/hello') },
    ]);
});

test.each([1, 2])(
    "supabase/deno-lint fails with Deno's error text when Deno exits %i without a JSON report",
    async (code) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['supabase']),
            'supabase/functions/greet/index.ts': 'export {};',
            'supabase/functions/greet/deno.json': '{',
        });

        using resources = new DisposableStack();
        const session = await openFakeToolSession(sandbox.path, ['deno'], resources);
        resources.use(
            spyOn(processes, 'spawnProcess').mockResolvedValue(
                buildProcessResult({ code, stderr: 'The project configuration is invalid.' }),
            ),
        );
        const error = await captureRejection(runSandboxCheck(session.root, 'supabase/deno-lint'));
        expect(error.message).toBe('The project configuration is invalid.');
    },
);

test('a configured edge entrypoint and import map reach Deno, unless deno.json takes precedence', async () => {
    await using sandbox = await testdir({
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
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['supabase']),
        'supabase/config.toml': '',
    });
    using resources = new DisposableStack();
    const session = await openFakeToolSession(sandbox.path, ['deno'], resources);
    for (const name of ['supabase/deno-lint', 'supabase/deno-check']) {
        const result = await runChecks(session, buildRunOptions({ only: [name] }));
        expect(result.report.checks[0]).toMatchObject({
            status: 'skipped',
            note: 'No edge function under supabase/functions.',
        });
    }
});

async function prepareDenoSession(root: string) {
    using resources = new DisposableStack();
    const session = await openFakeToolSession(root, ['deno'], resources);
    const run = resources.use(
        spyOn(processes, 'spawnProcess').mockResolvedValue(
            buildProcessResult({ stdout: '{"diagnostics":[],"errors":[]}' }),
        ),
    );
    const owned = resources.move();
    return { session, run, [Symbol.dispose]: owned[Symbol.dispose].bind(owned) };
}

test('Deno type errors use their location or the entrypoint, and successful checks clear the findings', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['supabase']),
        'supabase/functions/greet/index.ts': 'export {};\n',
        'supabase/functions/greet/deno.json': '{}\n',
        'supabase/functions/plain/index.ts': 'export {};\n',
    });
    using resources = new DisposableStack();
    await openFakeToolSession(sandbox.path, ['deno'], resources);
    const location = pathToFileURL(join(sandbox.path, 'supabase/functions/greet/util.ts')).href;
    const run = resources.use(
        spyOn(processes, 'spawnProcess').mockImplementation((command) =>
            Promise.resolve(
                buildProcessResult({
                    code: 1,
                    stderr:
                        command.at(-1)?.includes(join('greet', 'index.ts')) === true
                            ? `\u001B[31merror\u001B[0m: TS2322 [ERROR]: Type mismatch.\n    at ${location}:4:7\n`
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
    run.mockResolvedValue(buildProcessResult());
    expect(await runSandboxCheck(sandbox.path, 'supabase/deno-check')).toStrictEqual([]);
});
