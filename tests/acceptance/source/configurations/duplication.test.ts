import { delimiter, join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { commitAll } from '#tests/support/cli/git.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { install, toolsPath } from '#tests/support/cli/tools.ts';
// Planted repository for the duplication configuration: one block copied into a second file.
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';

const NPM_BIN = join(import.meta.dir, '../../../../node_modules/.bin');
const INIT = [
    'init',
    '--yes',
    '--configurations',
    'bash',
    'duplication',
    '--without',
    'naming',
    '--no-runner',
    '--no-ci',
    '--no-hooks',
    '--no-rules',
    '--no-install',
];
const STEPS = Array.from(
    { length: 30 },
    (_, index) => `    printf 'step %s of %s\\n' "${String(index)}" "$total"\n    total=$((total + ${String(index)}))`,
).join('\n');
const copied = (name: string): string =>
    `#!/usr/bin/env bash\nset -euo pipefail\n\n${name}() {\n    local total=0\n${STEPS}\n    printf '%s\\n' "$total"\n}\n\n${name}\n`;

describe('the duplication configuration', () => {
    test(
        'a block copied between two files is a finding on the file that holds it',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, { 'scripts/first.sh': copied('count_first') });
            commitAll(sandbox.path);
            const environment = { PATH: `${NPM_BIN}${delimiter}${toolsPath(['shellcheck', 'shfmt', 'typos', 'ec'])}` };
            await install(sandbox.path, INIT, environment);
            const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            const clean = await run(
                sandbox.path,
                ['check', '--only', 'duplication/jscpd', '--no-cache', '--json'],
                environment,
            );
            expect(clean.code, clean.stdout + clean.stderr).toBe(0);
            await Bun.write(`${sandbox.path}/scripts/second.sh`, copied('count_second'));
            commitAll(sandbox.path);
            const found = await run(
                sandbox.path,
                ['check', '--only', 'duplication/jscpd', '--no-cache', '--json'],
                environment,
            );
            expect(found.code, found.stdout + found.stderr).toBe(1);
            const report = reportSchema.parse(JSON.parse(found.stdout));
            expect(report.checks).toMatchObject([{ check: 'duplication/jscpd', status: 'fail' }]);
            expect(report.checks[0]!.findings, found.stdout).toStrictEqual([
                expect.objectContaining({
                    check: 'duplication/jscpd',
                    file: 'scripts/second.sh',
                    line: 4,
                    rule: 'copied-block',
                    message: expect.stringContaining('lines repeat scripts/first.sh:4.'),
                }),
            ]);
            await Bun.write(
                join(sandbox.path, 'scripts/second.sh'),
                '#!/usr/bin/env bash\nprintf "Independent task\\n"\n',
            );
            const corrected = await run(
                sandbox.path,
                ['check', '--only', 'duplication/jscpd', '--no-cache', '--json'],
                environment,
            );
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            expect(reportSchema.parse(JSON.parse(corrected.stdout)).checks).toMatchObject([
                { check: 'duplication/jscpd', status: 'ok', findings: [] },
            ]);
        },
        PLANTED_TIMEOUT_MS * 2,
    );
});
