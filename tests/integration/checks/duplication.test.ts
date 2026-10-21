import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { commitAll } from '#tests/setup/git.ts';
import type { RunReport } from '#cli/types/runs/run.ts';
import { installSandbox } from '#tests/setup/install.ts';
import { matchFields, matchSubstring } from '#tests/setup/matchers.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/run-gspot.ts';

/** Run the jscpd check, check its exit code, and return its report. */
async function checkDuplication(root: string, environment: Record<string, string>, code: number): Promise<RunReport> {
    const result = parseCheckReport(
        await spawnGspot(root, ['check', '--only', 'duplication/jscpd', '--json'], environment),
    );
    expect(result.code, result.stdout + result.stderr).toBe(code);
    return result.report;
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
    await using sandbox = await testdir({
        'scripts/first.sh': `#!/usr/bin/env bash\nset -euo pipefail\n\ncount_first() {\n    local total=0\n${steps}\n    printf '%s\\n' "$total"\n}\n\ncount_first\n`,
        'metadata/first.json': metadata,
        'metadata/second.json': metadata,
    });

    commitAll(sandbox.path);
    const environment = {};
    await installSandbox(
        { root: sandbox.path, environment: environment, run: spawnGspot },
        { configurations: ['bash'], level: 'all' },
    );
    await checkDuplication(sandbox.path, environment, 0);
    await writeFile(
        join(sandbox.path, 'scripts/second.sh'),
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
    await writeFile(join(sandbox.path, 'scripts/second.sh'), '#!/usr/bin/env bash\nprintf "Independent task\\n"\n');
    const corrected = await checkDuplication(sandbox.path, environment, 0);
    expect(corrected.checks).toMatchObject([{ check: 'duplication/jscpd', status: 'passed', findings: [] }]);
});
