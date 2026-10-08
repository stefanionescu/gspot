// Sandbox for the duplication configuration: one block copied into a second file.
import { join } from 'node:path';
import { commitAll } from '#tests/harness/git.ts';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { containing, textContaining } from '#tests/harness/expectations.ts';
import { initRepository, buildSandboxPath } from '#tests/harness/install.ts';

import {
    COMMAND_STEPS,
    DUPLICATION_INIT,
    METADATA_ENTRIES,
} from '#tests/config/tools/configurations/general/duplication.ts';

/** Run the selected check and verify its contractual exit before reading its report. */
async function checkDuplication(root: string, environment: Record<string, string>, code: number): Promise<RunReport> {
    const result = await spawnGspot(root, ['check', '--only', 'duplication/jscpd', '--json'], environment);
    expect(result.code, result.stdout + result.stderr).toBe(code);
    return JSON.parse(result.stdout) as RunReport;
}

describe('the duplication configuration', () => {
    test('a block copied between two files is a finding on the file that holds it', async () => {
        const metadata = JSON.stringify(
            Array.from({ length: METADATA_ENTRIES }, (_, value) => ({ name: `entry-${String(value)}`, value })),
            null,
            4,
        );
        const steps = Array.from(
            { length: COMMAND_STEPS },
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
            PATH: buildSandboxPath(['typos', 'editorconfig-checker']),
        };
        await initRepository(sandbox.path, DUPLICATION_INIT, environment, { level: 'all' });
        await checkDuplication(sandbox.path, environment, 0);
        await Bun.write(
            `${sandbox.path}/scripts/second.sh`,
            `#!/usr/bin/env bash\nset -euo pipefail\n\ncount_second() {\n    local total=0\n${steps}\n    printf '%s\\n' "$total"\n}\n\ncount_second\n`,
        );
        commitAll(sandbox.path);
        const report = await checkDuplication(sandbox.path, environment, 1);
        expect(report.checks).toMatchObject([{ check: 'duplication/jscpd', status: 'failed' }]);
        expect(report.checks[0]!.findings).toStrictEqual([
            containing({
                check: 'duplication/jscpd',
                file: 'scripts/second.sh',
                line: 4,
                rule: 'clone',
                message: textContaining('lines repeat scripts/first.sh:4.'),
            }),
        ]);
        await Bun.write(join(sandbox.path, 'scripts/second.sh'), '#!/usr/bin/env bash\nprintf "Independent task\\n"\n');
        const corrected = await checkDuplication(sandbox.path, environment, 0);
        expect(corrected.checks).toMatchObject([{ check: 'duplication/jscpd', status: 'passed', findings: [] }]);
    });
});
