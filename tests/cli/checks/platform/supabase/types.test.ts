import executables from 'which';
import { join, isAbsolute } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { planRun } from '#cli/planning/public.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { executeRun } from '#cli/execution/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { BUILT_IN_CHECKS } from '#cli/checks/public.ts';
import { checkInput } from '#cli/execution/contracts.ts';
import { stat, chmod, readFile } from 'node:fs/promises';
import { buildRunOptions } from '#tests/harness/gspot.ts';
import { getKeptMode } from '#tests/harness/platforms.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { rejection, textContaining } from '#tests/harness/expectations.ts';
import { GENERATED_TYPES, DATABASE_SCHEMAS } from '#tests/config/cli/checks/platform/supabase/types.ts';
import type { SupabaseProject, SupabaseInvocation } from '#tests/types/cli/checks/platform/supabase.ts';

async function prepareSupabaseCheck(
    root: string,
    scope: string,
    outcome: Awaited<ReturnType<typeof processes.run>>,
    schemas?: string[],
): Promise<SupabaseProject> {
    const prefix = scope === '' ? '' : `${scope}/`;
    const policy =
        scope === '' ? '[supabase]' : `[scope."${scope}"]\nconfigurations = ["supabase"]\n[scope."${scope}".supabase]`;
    const declared = schemas === undefined ? '' : `schemas = ${JSON.stringify(schemas)}\n`;
    await createFileTree(root, {
        'gspot.toml': buildPolicy(['supabase'], {
            tables: `${policy}\ntypes_file = "database.ts"\n${declared}`,
        }),
        [`${prefix}supabase/config.toml`]: 'project_id = "types-fixture"\n',
    });
    const execute = async () => {
        const session = await openSession(root);
        const outcome = await executeRun(session, buildRunOptions({ only: ['supabase/stale-types'] }));
        return outcome.report.checks.find((check) => check.scope === scope)!;
    };
    const requests: SupabaseInvocation[] = [];
    const blocking = processes.runBlocking;
    const version = spyOn(processes, 'runBlocking').mockImplementation((argv, options) =>
        ['/fixture/supabase', '/fixture/docker'].includes(argv[0] ?? '')
            ? {
                  code: 0,
                  stdout: argv[0] === '/fixture/docker' ? 'Docker version 29.2.1\n' : '2.75.0\n',
                  stderr: '',
                  missing: false,
                  duration: 1,
              }
            : blocking(argv, options),
    );
    const findExecutable = executables.sync;
    const which = spyOn(executables, 'sync').mockImplementation(((name: string) =>
        ['supabase', 'docker'].includes(name)
            ? `/fixture/${name}`
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
            check: 'supabase/stale-types',
            status: 'failed',
            findings: [
                {
                    file: `${prefix}database.ts`,
                    line: 1,
                    rule: 'missing',
                    message: textContaining(`${prefix}database.ts`),
                },
            ],
        });
        await Bun.write(join(sandbox.path, prefix, 'database.ts'), 'export type Database = {};\n');
        await chmod(join(sandbox.path, prefix, 'database.ts'), 0o640);
        const stale = await execute();
        expect(stale).toMatchObject({
            status: 'failed',
            findings: [{ check: 'supabase/stale-types', file: `${prefix}database.ts`, rule: 'stale', line: 1 }],
        });
        expect(await readFile(join(sandbox.path, prefix, 'database.ts'), 'utf8')).toBe('export type Database = {};\n');
        const output = await stat(join(sandbox.path, prefix, 'database.ts'));
        expect(output.mode & 0o777).toBe(getKeptMode(0o640));
        await Bun.write(join(sandbox.path, prefix, 'database.ts'), GENERATED_TYPES);
        expect(await execute()).toMatchObject({ status: 'passed', findings: [] });
        expect(fixture.requests.length).toBeGreaterThan(0);
        for (const request of fixture.requests) {
            expect(isAbsolute(request.cwd)).toBe(true);
            expect(request.cwd).not.toBe(join(sandbox.path, scope));
            expect(await pathExists(request.cwd)).toBe(false);
            expect(request).toStrictEqual({
                args: ['gen', 'types', 'typescript', '--local', '--schema', 'public'],
                cwd: request.cwd,
            });
        }
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
        await chmod(join(sandbox.path, prefix, 'database.ts'), 0o640);
        expect(await execute()).toMatchObject({
            status: 'error',
            findings: [],
            note: textContaining('Database is unavailable'),
        });
        const session = await openSession(sandbox.path);
        const plans = planRun(session, { stage: 'push', only: ['supabase/stale-types'], skips: [] });
        const planned = plans.find((check) => check.scope.scope.path === scope)!;
        const input = checkInput(session, planned);
        input.cancelSignal = AbortSignal.abort();
        expect(await rejection(BUILT_IN_CHECKS['supabase/stale-types'].input(input))).toContain(
            'The command was canceled.',
        );
        expect(await readFile(join(sandbox.path, prefix, 'database.ts'), 'utf8')).toBe(GENERATED_TYPES);
        const output = await stat(join(sandbox.path, prefix, 'database.ts'));
        expect(output.mode & 0o777).toBe(getKeptMode(0o640));
        expect(fixture.requests.length).toBeGreaterThan(0);
        for (const request of fixture.requests) {
            expect(isAbsolute(request.cwd)).toBe(true);
            expect(request.cwd).not.toBe(join(sandbox.path, scope));
            expect(await pathExists(request.cwd)).toBe(false);
            expect(request).toStrictEqual({
                args: ['gen', 'types', 'typescript', '--local', '--schema', 'public'],
                cwd: request.cwd,
            });
        }
    },
);

test.each(['', 'apps/api'])('Supabase passes every configured schema separately in %s', async (scope) => {
    await using sandbox = await testdir();
    using fixture = await prepareSupabaseCheck(
        sandbox.path,
        scope,
        {
            code: 0,
            stdout: GENERATED_TYPES,
            stderr: '',
            missing: false,
            duration: 1,
        },
        DATABASE_SCHEMAS,
    );
    await Bun.write(join(sandbox.path, fixture.prefix, 'database.ts'), GENERATED_TYPES);
    expect(await fixture.execute()).toMatchObject({ status: 'passed', findings: [] });
    const request = fixture.requests[0]!;
    expect(request.cwd).not.toBe(join(sandbox.path, scope));
    expect(await pathExists(request.cwd)).toBe(false);
    expect(fixture.requests).toStrictEqual([
        {
            args: [
                'gen',
                'types',
                'typescript',
                '--local',
                ...DATABASE_SCHEMAS.flatMap((schema) => ['--schema', schema]),
            ],
            cwd: request.cwd,
        },
    ]);
});

test('Supabase types need Docker before invoking the local stack', async () => {
    await using sandbox = await testdir();
    using fixture = await prepareSupabaseCheck(sandbox.path, '', {
        code: 0,
        stdout: GENERATED_TYPES,
        stderr: '',
        missing: false,
        duration: 1,
    });
    await Bun.write(join(sandbox.path, 'database.ts'), GENERATED_TYPES);
    const find = spyOn(executables, 'sync').mockImplementation(((name: string) =>
        name === 'supabase' ? '/fixture/supabase' : null) as typeof executables.sync);
    try {
        expect(await fixture.execute()).toMatchObject({
            status: 'missing',
            note: 'Docker is not installed. Install Docker to run this check.',
        });
        expect(fixture.requests).toStrictEqual([]);
    } finally {
        find.mockRestore();
    }
});
