import { join } from 'node:path';
import { expect, spyOn, test } from 'bun:test';
import { planRun } from '#cli/execution/plan.ts';
import { createFileTree, testdir } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { openSession } from '#cli/execution/session.ts';
import { rejection } from '#tests/support/rejection.ts';
import { chmodSync, readFileSync, statSync } from 'node:fs';
import { typesFresh } from '#cli/checks/supabase/types-fresh.ts';
import { engineInput, runEngineCheck } from '#cli/execution/engines.ts';

const generated = 'export type Database = { public: { Tables: {} } };\n';

test.each(['', 'apps/api'])(
    'Supabase freshness reports missing and stale types, accepts matching bytes, and preserves authored files in %s',
    async (scope) => {
        await using sandbox = await testdir();
        const prefix = scope === '' ? '' : `${scope}/`;
        const policy =
            scope === ''
                ? '[tools.supabase]'
                : `[[scope]]\npath = "${scope}"\nconfigurations = ["supabase"]\n[scope.tools.supabase]`;
        await createFileTree(sandbox.path, {
            'gspot.toml': `version = 1\nconfigurations = ["supabase"]\n${policy}\ntypes_file = "database.ts"\n`,
            [`${prefix}supabase/config.toml`]: 'project_id = "types-fixture"\n',
        });
        const execute = async () => {
            const session = await openSession(sandbox.path);
            const planned = (await planRun(session, { stage: 'push', only: ['supabase/types-fresh'], skips: [] })).find(
                (check) => check.scope.scope.path === scope,
            )!;
            return await runEngineCheck(session, typesFresh, planned);
        };
        const missing = await execute();
        expect(missing).toMatchObject({
            check: 'supabase/types-fresh',
            status: 'fail',
            findings: [
                { file: `${prefix}database.ts`, line: 1, rule: 'types', message: 'The types file does not exist.' },
            ],
        });
        await Bun.write(join(sandbox.path, prefix, 'database.ts'), 'export type Database = {};\n');
        chmodSync(join(sandbox.path, prefix, 'database.ts'), 0o640);
        const blocking = processes.runBlocking;
        const version = spyOn(processes, 'runBlocking').mockImplementation((argv, options) =>
            argv[0] === '/fixture/supabase'
                ? { code: 0, stdout: '2.75.0\n', stderr: '', missing: false, duration: 1 }
                : blocking(argv, options),
        );
        const resolve = Bun.which;
        const which = spyOn(Bun, 'which').mockImplementation((name, options) =>
            name === 'supabase' ? '/fixture/supabase' : resolve(name, options),
        );
        const executeProcess = processes.run;
        let failed = false;
        const run = spyOn(processes, 'run').mockImplementation(async (argv, options) => {
            if (argv[0] !== '/fixture/supabase') return executeProcess(argv, options);
            expect(argv.slice(1)).toStrictEqual(['gen', 'types', 'typescript', '--local']);
            expect(options.cwd).toBe(join(sandbox.path, scope));
            return {
                code: failed ? 1 : 0,
                stdout: failed ? '' : generated,
                stderr: failed ? 'Database is unavailable' : '',
                missing: false,
                duration: 1,
            };
        });
        try {
            const stale = await execute();
            expect(stale).toMatchObject({
                status: 'fail',
                findings: [{ check: 'supabase/types-fresh', file: `${prefix}database.ts`, rule: 'types', line: 1 }],
            });
            expect(readFileSync(join(sandbox.path, prefix, 'database.ts'), 'utf8')).toBe(
                'export type Database = {};\n',
            );
            expect(statSync(join(sandbox.path, prefix, 'database.ts')).mode & 0o777).toBe(0o640);
            await Bun.write(join(sandbox.path, prefix, 'database.ts'), generated);
            expect(await execute()).toMatchObject({ status: 'ok', findings: [] });
            failed = true;
            expect(await execute()).toMatchObject({
                status: 'error',
                findings: [],
                note: expect.stringContaining('Database is unavailable'),
            });
            const session = await openSession(sandbox.path);
            const planned = (await planRun(session, { stage: 'push', only: ['supabase/types-fresh'], skips: [] })).find(
                (check) => check.scope.scope.path === scope,
            )!;
            const input = engineInput(session, planned);
            input.cancelSignal = AbortSignal.abort();
            expect((await rejection(typesFresh(input))).message).toContain('The command was canceled.');
            expect(readFileSync(join(sandbox.path, prefix, 'database.ts'), 'utf8')).toBe(generated);
            expect(statSync(join(sandbox.path, prefix, 'database.ts')).mode & 0o777).toBe(0o640);
        } finally {
            run.mockRestore();
            which.mockRestore();
            version.mockRestore();
        }
    },
);
