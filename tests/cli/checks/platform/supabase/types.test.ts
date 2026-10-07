import executables from 'which';
import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { planRun } from '#cli/planning/plan.ts';
import { executeRun } from '#cli/execution/run.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { checkInput } from '#cli/execution/built-in.ts';
import { buildRunOptions } from '#tests/harness/gspot.ts';
import { getKeptMode } from '#tests/harness/platforms.ts';
import { statSync, chmodSync, readFileSync } from 'node:fs';
import { typesFresh } from '#cli/checks/platform/supabase.ts';
import { rejection, textContaining } from '#tests/harness/expectations.ts';
import { GENERATED_TYPES } from '#tests/config/cli/checks/platform/supabase/types.ts';
import type { SupabaseProject, SupabaseInvocation } from '#tests/types/cli/checks/platform/supabase.ts';

async function prepareSupabaseCheck(
    root: string,
    scope: string,
    outcome: Awaited<ReturnType<typeof processes.run>>,
): Promise<SupabaseProject> {
    const prefix = scope === '' ? '' : `${scope}/`;
    const policy =
        scope === '' ? '[supabase]' : `[[scope]]\npath = "${scope}"\nconfigurations = ["supabase"]\n[scope.supabase]`;
    await createFileTree(root, {
        'gspot.toml': buildPolicy(['supabase'], { tables: `${policy}\ntypes_file = "database.ts"\n` }),
        [`${prefix}supabase/config.toml`]: 'project_id = "types-fixture"\n',
    });
    const execute = async () => {
        const session = await openSession(root);
        const outcome = await executeRun(session, buildRunOptions({ only: ['supabase/types-fresh'] }));
        return outcome.report.checks.find((check) => check.scope === scope)!;
    };
    const requests: SupabaseInvocation[] = [];
    const blocking = processes.runBlocking;
    const version = spyOn(processes, 'runBlocking').mockImplementation((argv, options) =>
        argv[0] === '/fixture/supabase'
            ? { code: 0, stdout: '2.75.0\n', stderr: '', missing: false, duration: 1 }
            : blocking(argv, options),
    );
    const findExecutable = executables.sync;
    const which = spyOn(executables, 'sync').mockImplementation(((name: string) =>
        name === 'supabase'
            ? '/fixture/supabase'
            : findExecutable(name, { nothrow: true })) as typeof executables.sync);
    const executeProcess = processes.run;
    const run = spyOn(processes, 'run').mockImplementation(async (argv, options) => {
        if (argv[0] !== '/fixture/supabase') return executeProcess(argv, options);
        requests.push({ args: argv.slice(1), cwd: options.cwd });
        return outcome;
    });
    return {
        prefix,
        execute,
        requests,
        [Symbol.dispose]() {
            run.mockRestore();
            which.mockRestore();
            version.mockRestore();
        },
    };
}

test.each(['', 'apps/api'])(
    'Supabase freshness reports missing and stale types then accepts matching bytes in %s',
    async (scope) => {
        await using sandbox = await testdir();
        using fixture = await prepareSupabaseCheck(sandbox.path, scope, {
            code: 0,
            stdout: GENERATED_TYPES,
            stderr: '',
            missing: false,
            duration: 1,
        });
        const { prefix, execute } = fixture;
        const missing = await execute();
        expect(missing).toMatchObject({
            check: 'supabase/types-fresh',
            status: 'failed',
            findings: [
                {
                    file: `${prefix}database.ts`,
                    line: 1,
                    rule: 'missing',
                    message: 'Run supabase gen types typescript --local and write its output to database.ts.',
                },
            ],
        });
        await Bun.write(join(sandbox.path, prefix, 'database.ts'), 'export type Database = {};\n');
        chmodSync(join(sandbox.path, prefix, 'database.ts'), 0o640);
        const stale = await execute();
        expect(stale).toMatchObject({
            status: 'failed',
            findings: [{ check: 'supabase/types-fresh', file: `${prefix}database.ts`, rule: 'stale', line: 1 }],
        });
        expect(readFileSync(join(sandbox.path, prefix, 'database.ts'), 'utf8')).toBe('export type Database = {};\n');
        expect(statSync(join(sandbox.path, prefix, 'database.ts')).mode & 0o777).toBe(getKeptMode(0o640));
        await Bun.write(join(sandbox.path, prefix, 'database.ts'), GENERATED_TYPES);
        expect(await execute()).toMatchObject({ status: 'passed', findings: [] });
        expect(fixture.requests.length).toBeGreaterThan(0);
        for (const request of fixture.requests)
            expect(request).toStrictEqual({
                args: ['gen', 'types', 'typescript', '--local'],
                cwd: join(sandbox.path, scope),
            });
    },
);

test.each(['', 'apps/api'])(
    'Supabase execution failures and cancellation preserve authored bytes and modes in %s',
    async (scope) => {
        await using sandbox = await testdir();
        using fixture = await prepareSupabaseCheck(sandbox.path, scope, {
            code: 1,
            stdout: '',
            stderr: 'Database is unavailable',
            missing: false,
            duration: 1,
        });
        const { prefix, execute } = fixture;
        await Bun.write(join(sandbox.path, prefix, 'database.ts'), GENERATED_TYPES);
        chmodSync(join(sandbox.path, prefix, 'database.ts'), 0o640);
        expect(await execute()).toMatchObject({
            status: 'error',
            findings: [],
            note: textContaining('Database is unavailable'),
        });
        const session = await openSession(sandbox.path);
        const plans = planRun(session, { stage: 'push', only: ['supabase/types-fresh'], skips: [] });
        const planned = plans.find((check) => check.scope.scope.path === scope)!;
        const input = checkInput(session, planned);
        input.cancelSignal = AbortSignal.abort();
        expect(await rejection(typesFresh(input))).toContain('The command was canceled.');
        expect(readFileSync(join(sandbox.path, prefix, 'database.ts'), 'utf8')).toBe(GENERATED_TYPES);
        expect(statSync(join(sandbox.path, prefix, 'database.ts')).mode & 0o777).toBe(getKeptMode(0o640));
        expect(fixture.requests.length).toBeGreaterThan(0);
        for (const request of fixture.requests)
            expect(request).toStrictEqual({
                args: ['gen', 'types', 'typescript', '--local'],
                cwd: join(sandbox.path, scope),
            });
    },
);
