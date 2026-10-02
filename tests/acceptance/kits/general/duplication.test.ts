// Planted repository for the duplication configuration: one block copied into a second file.
import { join, delimiter } from 'node:path';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { commitAll } from '#tests/harness/cli/git.ts';
import { spawnGspot } from '#tests/harness/cli/command.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { containing, textContaining } from '#tests/harness/expectations.ts';
import { toolsPath, installAtLevel } from '#tests/harness/tools/install.ts';

const DUPLICATION_INIT = [
    'init',
    '--yes',
    '--kits',
    'bash',
    'duplication',
    '--no-runner',
    '--no-ci',
    '--no-hooks',
    '--no-rules',
    '--no-install',
];

/** The kits the duplication sandbox leaves out after init. */
const DUPLICATION_LEFT_OUT = ['naming'];

const NPM_BIN = join(import.meta.dir, '../../../../node_modules/.bin');
const STEPS = Array.from(
    { length: 30 },
    (_, index) => `    printf 'step %s of %s\\n' "${String(index)}" "$total"\n    total=$((total + ${String(index)}))`,
).join('\n');
describe('the duplication configuration', () => {
    test(
        'a block copied between two files is a finding on the file that holds it',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'scripts/first.sh': `#!/usr/bin/env bash\nset -euo pipefail\n\ncount_first() {\n    local total=0\n${STEPS}\n    printf '%s\\n' "$total"\n}\n\ncount_first\n`,
            });
            commitAll(sandbox.path);
            const environment = { PATH: `${NPM_BIN}${delimiter}${toolsPath(['shellcheck', 'shfmt', 'typos', 'ec'])}` };
            await installAtLevel(sandbox.path, DUPLICATION_INIT, environment, 'all', DUPLICATION_LEFT_OUT);
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
            expect(report.checks).toMatchObject([{ check: 'duplication/jscpd', status: 'fail' }]);
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
                { check: 'duplication/jscpd', status: 'ok', findings: [] },
            ]);
        },
        PLANTED_TIMEOUT_MS * 2,
    );
});
