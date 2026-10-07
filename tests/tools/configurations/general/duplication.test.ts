// Test repository for the duplication configuration: one block copied into a second file.
import { join } from 'node:path';
import { commitAll } from '#tests/harness/git.ts';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { install, buildSandboxPath } from '#tests/harness/install.ts';
import { containing, textContaining } from '#tests/harness/expectations.ts';
import { STEPS, METADATA, DUPLICATION_INIT } from '#tests/config/tools/configurations/general/duplication.ts';

describe('the duplication configuration', () => {
    test(
        'a block copied between two files is a finding on the file that holds it',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'scripts/first.sh': `#!/usr/bin/env bash\nset -euo pipefail\n\ncount_first() {\n    local total=0\n${STEPS}\n    printf '%s\\n' "$total"\n}\n\ncount_first\n`,
                'metadata/first.json': METADATA,
                'metadata/second.json': METADATA,
            });
            commitAll(sandbox.path);
            const environment = {
                PATH: buildSandboxPath(['typos', 'ec']),
            };
            await install(sandbox.path, DUPLICATION_INIT, environment, { level: 'all' });
            const clean = await spawnGspot(
                sandbox.path,
                ['check', '--only', 'duplication/jscpd', '--json'],
                environment,
            );
            expect(clean.code, clean.stdout + clean.stderr).toBe(0);
            await Bun.write(
                `${sandbox.path}/scripts/second.sh`,
                `#!/usr/bin/env bash\nset -euo pipefail\n\ncount_second() {\n    local total=0\n${STEPS}\n    printf '%s\\n' "$total"\n}\n\ncount_second\n`,
            );
            commitAll(sandbox.path);
            const found = await spawnGspot(
                sandbox.path,
                ['check', '--only', 'duplication/jscpd', '--json'],
                environment,
            );
            expect(found.code, found.stdout + found.stderr).toBe(1);
            const report = JSON.parse(found.stdout) as RunReport;
            expect(report.checks).toMatchObject([{ check: 'duplication/jscpd', status: 'failed' }]);
            expect(report.checks[0]!.findings, found.stdout).toStrictEqual([
                containing({
                    check: 'duplication/jscpd',
                    file: 'scripts/second.sh',
                    line: 4,
                    rule: 'clone',
                    message: textContaining('lines repeat scripts/first.sh:4.'),
                }),
            ]);
            await Bun.write(
                join(sandbox.path, 'scripts/second.sh'),
                '#!/usr/bin/env bash\nprintf "Independent task\\n"\n',
            );
            const correctedCheck = await spawnGspot(
                sandbox.path,
                ['check', '--only', 'duplication/jscpd', '--json'],
                environment,
            );
            expect(correctedCheck.code, correctedCheck.stdout + correctedCheck.stderr).toBe(0);
            expect((JSON.parse(correctedCheck.stdout) as RunReport).checks).toMatchObject([
                { check: 'duplication/jscpd', status: 'passed', findings: [] },
            ]);
        },
        NATIVE_TEST_TIMEOUT_MS,
    );
});
