/** Number of metadata rows outside the selected source scan. */

/** Number of Bash commands in the copied source block. */

/** Number of metadata rows outside the selected source scan. */

/** Number of Bash commands in the copied source block. */

import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/setup/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { buildInitArguments } from '#tests/setup/builders.ts';
import type { RunReport } from '#cli/types/checks/run/check.ts';
import { matchFields, matchSubstring } from '#tests/setup/matchers.ts';
import { installSandbox, buildSandboxPath } from '#tests/setup/install.ts';

/** Run the selected check and verify its contractual exit before reading its report. */
async function checkDuplication(root: string, environment: Record<string, string>, code: number): Promise<RunReport> {
    const result = await spawnGspot(root, ['check', '--only', 'duplication/jscpd', '--json'], environment);
    expect(result.code, result.stdout + result.stderr).toBe(code);
    return JSON.parse(result.stdout) as RunReport;
}

test('a block copied between two files is a finding on the file that holds it', async () => {
    const metadata = JSON.stringify(
        Array.from({ length: 40 }, (_, value) => ({ name: `entry-${String(value)}`, value })),
        null,
        4,
    );
    const steps = Array.from(
        { length: 30 },
        (_, index) =>
            `    printf 'step %s of %s\\n' "${String(index)}" "$total"\n    total=$((total + ${String(index)}))`,
    ).join('\n');
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'scripts/first.sh': `#!/usr/bin/env bash\nset -euo pipefail\n\ncount_first() {\n    local total=0\n${steps}\n    printf '%s\\n' "$total"\n}\n\ncount_first\n`,
        'metadata/first.json': metadata,
        'metadata/second.json': metadata,
    });
    commitAll(sandbox.path);
    const environment = {
        PATH: buildSandboxPath(),
    };
    await installSandbox(sandbox.path, buildInitArguments(['bash']), environment, { level: 'all' });
    expect(await spawnGspot(sandbox.path, ['install'])).toMatchObject({ code: 0 });
    await checkDuplication(sandbox.path, environment, 0);
    await Bun.write(
        `${sandbox.path}/scripts/second.sh`,
        `#!/usr/bin/env bash\nset -euo pipefail\n\ncount_second() {\n    local total=0\n${steps}\n    printf '%s\\n' "$total"\n}\n\ncount_second\n`,
    );
    const report = await checkDuplication(sandbox.path, environment, 1);
    expect(report.checks).toMatchObject([{ check: 'duplication/jscpd', status: 'failed' }]);
    expect(report.checks[0]!.findings).toStrictEqual([
        matchFields({
            check: 'duplication/jscpd',
            file: 'scripts/second.sh',
            line: 4,
            rule: 'clone',
            message: matchSubstring('lines repeat scripts/first.sh:4.'),
        }),
    ]);
    await Bun.write(join(sandbox.path, 'scripts/second.sh'), '#!/usr/bin/env bash\nprintf "Independent task\\n"\n');
    const corrected = await checkDuplication(sandbox.path, environment, 0);
    expect(corrected.checks).toMatchObject([{ check: 'duplication/jscpd', status: 'passed', findings: [] }]);
});
