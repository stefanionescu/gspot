import executables from 'which';
import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { planRun } from '#cli/execution/planning/plan.ts';
import { keptMode } from '#tests/harness/cli/platforms.ts';
import { statSync, chmodSync, readFileSync } from 'node:fs';
import type { CheckResult } from '#cli/types/execution/execution.ts';
import { engineInput, runEngineCheck } from '#cli/execution/engines.ts';
import { typesFresh } from '#cli/checks/platform/supabase/types-fresh.ts';
import { rejection, textContaining } from '#tests/harness/expectations.ts';

async function prepareSupabaseCheck(
    root: string,
    scope: string,
    outcome: Awaited<ReturnType<typeof processes.run>>,
): Promise<{
    prefix: string;
    execute: () => Promise<CheckResult>;
    requests: { args: string[]; cwd: string }[];
    [Symbol.dispose](): void;
}> {
    const prefix = scope === '' ? '' : `${scope}/`;
    const policy =
        scope === '' ? '[tools.supabase]' : `[[scope]]\npath = "${scope}"\nkits = ["supabase"]\n[scope.tools.supabase]`;
    await createFileTree(root, {
        'gspot.toml': policyOf(['supabase'], `${policy}\ntypes_file = "database.ts"\n`),
        [`${prefix}supabase/config.toml`]: 'project_id = "types-fixture"\n',
    });
    const execute = async () => {
        const session = await openSession(root);
        const plans = planRun(session, { stage: 'push', only: ['supabase/types-fresh'], skips: [] });
        const planned = plans.find((check) => check.scope.scope.path === scope)!;
        return await runEngineCheck(session, typesFresh, planned);
    };
    const requests: { args: string[]; cwd: string }[] = [];
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

const generated = 'export type Database = { public: { Tables: {} } };\n';

test.each(['', 'apps/api'])(
    'Supabase freshness reports missing and stale types then accepts matching bytes in %s',
    async (scope) => {
        await using sandbox = await testdir();
        using fixture = await prepareSupabaseCheck(sandbox.path, scope, {
            code: 0,
            stdout: generated,
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
                { file: `${prefix}database.ts`, line: 1, rule: 'stale', message: 'The types file does not exist.' },
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
        expect(statSync(join(sandbox.path, prefix, 'database.ts')).mode & 0o777).toBe(keptMode(0o640));
        await Bun.write(join(sandbox.path, prefix, 'database.ts'), generated);
        expect(await execute()).toMatchObject({ status: 'passed', findings: [] });
        expect(fixture.requests).toStrictEqual([
            { args: ['gen', 'types', 'typescript', '--local'], cwd: join(sandbox.path, scope) },
            { args: ['gen', 'types', 'typescript', '--local'], cwd: join(sandbox.path, scope) },
        ]);
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
        await Bun.write(join(sandbox.path, prefix, 'database.ts'), generated);
        chmodSync(join(sandbox.path, prefix, 'database.ts'), 0o640);
        expect(await execute()).toMatchObject({
            status: 'error',
            findings: [],
            note: textContaining('Database is unavailable'),
        });
        const session = await openSession(sandbox.path);
        const plans = planRun(session, { stage: 'push', only: ['supabase/types-fresh'], skips: [] });
        const planned = plans.find((check) => check.scope.scope.path === scope)!;
        const input = engineInput(session, planned);
        input.cancelSignal = AbortSignal.abort();
        expect(await rejection(typesFresh(input))).toContain('The command was canceled.');
        expect(readFileSync(join(sandbox.path, prefix, 'database.ts'), 'utf8')).toBe(generated);
        expect(statSync(join(sandbox.path, prefix, 'database.ts')).mode & 0o777).toBe(keptMode(0o640));
        expect(fixture.requests).toStrictEqual([
            { args: ['gen', 'types', 'typescript', '--local'], cwd: join(sandbox.path, scope) },
        ]);
    },
);
