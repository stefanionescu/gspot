import { spyOn } from 'bun:test';
import { createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { openSession } from '#cli/execution/session.ts';
import { planRun } from '#cli/execution/planning/plan.ts';
import { runEngineCheck } from '#cli/execution/engines.ts';
import { policyOf } from '#tests/support/cli/policy/text.ts';
import { typesFresh } from '#cli/checks/supabase/types-fresh.ts';
import type { PrepareSupabaseCheckResult } from '#tests/types/results.ts';

/** Isolates the external Supabase executable while preserving real freshness planning and execution. */
export async function prepareSupabaseCheck(
    root: string,
    scope: string,
    outcome: Awaited<ReturnType<typeof processes.run>>,
): Promise<PrepareSupabaseCheckResult> {
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
    const findExecutable = Bun.which;
    const which = spyOn(Bun, 'which').mockImplementation((name, options) =>
        name === 'supabase' ? '/fixture/supabase' : findExecutable(name, options),
    );
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
