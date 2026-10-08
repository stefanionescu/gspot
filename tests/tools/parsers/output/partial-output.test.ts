import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { planRun } from '#cli/planning/plan.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { containing } from '#tests/harness/expectations.ts';
import { runTestCommandBlocking } from '#tests/harness/command.ts';
import { checkedFindings } from '#cli/execution/command/findings.ts';

test('partial ShellCheck output beside an unreadable file is an execution error', async () => {
    await using sandbox = await testdir();
    const source = '#!/usr/bin/env bash\necho $unquoted\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['bash']),
        'sample.sh': source,
    });
    const session = await openSession(sandbox.path);
    const plans = planRun(session, { stage: 'commit', skips: [], only: ['bash/shellcheck'] });
    const planned = plans[0]!;
    const command = ['shellcheck', '--norc', '--format=gcc', 'sample.sh'];
    const paths = { cwd: sandbox.path, root: sandbox.path };
    const broken = runTestCommandBlocking([...command, 'missing.sh'], { cwd: sandbox.path });
    expect(broken.code, broken.stderr).toBe(2);
    expect(broken.stdout).toContain('SC2086');
    expect(() => checkedFindings(planned, broken, paths)).toThrow('missing.sh');
    const defect = runTestCommandBlocking(command, { cwd: sandbox.path });
    expect(defect.code).toBe(1);
    expect(checkedFindings(planned, defect, paths)).toContainEqual(
        containing({ file: 'sample.sh', line: 2, rule: 'SC2086' }),
    );
    expect(await Bun.file(join(sandbox.path, 'sample.sh')).text()).toBe(source);
    await Bun.write(join(sandbox.path, 'sample.sh'), '#!/usr/bin/env bash\nprintf "%s\\n" "${1:-}"\n');
    const corrected = runTestCommandBlocking(command, { cwd: sandbox.path });
    expect(corrected.code).toBe(0);
    expect(checkedFindings(planned, corrected, paths)).toStrictEqual([]);
});
