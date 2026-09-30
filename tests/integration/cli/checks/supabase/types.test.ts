import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { engineInput } from '#cli/execution/engines.ts';
import { openSession } from '#cli/execution/session.ts';
import { planRun } from '#cli/execution/planning/plan.ts';
import { keptMode } from '#tests/support/cli/platforms.ts';
import { statSync, chmodSync, readFileSync } from 'node:fs';
import { typesFresh } from '#cli/checks/supabase/types-fresh.ts';
import { rejection, textContaining } from '#tests/support/expectations.ts';
import { prepareSupabaseCheck } from '#tests/support/cli/supabase/check.ts';

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
            status: 'fail',
            findings: [
                { file: `${prefix}database.ts`, line: 1, rule: 'types', message: 'The types file does not exist.' },
            ],
        });
        await Bun.write(join(sandbox.path, prefix, 'database.ts'), 'export type Database = {};\n');
        chmodSync(join(sandbox.path, prefix, 'database.ts'), 0o640);
        const stale = await execute();
        expect(stale).toMatchObject({
            status: 'fail',
            findings: [{ check: 'supabase/types-fresh', file: `${prefix}database.ts`, rule: 'types', line: 1 }],
        });
        expect(readFileSync(join(sandbox.path, prefix, 'database.ts'), 'utf8')).toBe('export type Database = {};\n');
        expect(statSync(join(sandbox.path, prefix, 'database.ts')).mode & 0o777).toBe(keptMode(0o640));
        await Bun.write(join(sandbox.path, prefix, 'database.ts'), generated);
        expect(await execute()).toMatchObject({ status: 'ok', findings: [] });
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
