// The Bash conventions a project names itself: none applies until the policy names it.
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { executeRun } from '#cli/execution/execute.ts';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { runOptions } from '#tests/harness/cli/command.ts';

const SCRIPT =
    '#!/usr/bin/env bash\nset -euo pipefail\n\n# main: deploys the release.\nmain() {\n    echo "$1"\n}\n\nrun_step() {\n    echo "$1"\n}\n\nrun_remote "$1" "\n    cd /srv\n    ./restart\n"\n\nmain "$@"\n';
const ONLY = ['structure/remote', 'structure/unused-functions', 'structure/bash-interpreter'];
// The rules the three conventions decide; the script is not executable, which the interpreter check also reports.
const RULES = new Set(['never-called', 'unnamed-block', 'header', 'runtime-header']);

async function rules(policy: string): Promise<string[]> {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': policyOf(['bash'], policy, 'all'), 'deploy.sh': SCRIPT });
    const run = await executeRun(await openSession(sandbox.path), runOptions({ only: ONLY }));
    return run.report.checks
        .flatMap(({ findings }) => findings.map(({ rule }) => rule ?? ''))
        .filter((rule) => RULES.has(rule))
        .toSorted((left, right) => left.localeCompare(right));
}

test('remote functions, entry functions, and the runtime header apply only once the policy names them', async () => {
    expect(await rules('')).toStrictEqual(['never-called']);
    expect(
        await rules(
            '[tools.bash]\nremote_functions = ["run_remote"]\nentry_functions = ["run_step"]\nplatforms = "Linux"\n',
        ),
    ).toStrictEqual(['header', 'runtime-header', 'unnamed-block']);
});
