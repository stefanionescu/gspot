import { delimiter, join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
// Planted repository for the duplication configuration: one block copied into a second file.
import { run } from '#tests/support/cli/command.ts';
import { commitAll } from '#tests/support/cli/git.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { expectCorrected } from '#tests/support/cli/planted.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/constants/support/cli.ts';
import { installAtLevel, toolsPath } from '#tests/support/cli/tools.ts';
import { containing, textContaining } from '#tests/support/expectations.ts';
import { DUPLICATION_INIT } from '#tests/constants/acceptance/source/configurations/init-arguments.ts';

const NPM_BIN = join(import.meta.dir, '../../../../node_modules/.bin');
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
            await installAtLevel(sandbox.path, DUPLICATION_INIT, environment);
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
                containing({
                    check: 'duplication/jscpd',
                    file: 'scripts/second.sh',
                    line: 4,
                    rule: 'copied-block',
                    message: textContaining('lines repeat scripts/first.sh:4.'),
                }),
            ]);
            await Bun.write(
                join(sandbox.path, 'scripts/second.sh'),
                '#!/usr/bin/env bash\nprintf "Independent task\\n"\n',
            );
            await expectCorrected(sandbox.path, 'duplication/jscpd', environment);
        },
        PLANTED_TIMEOUT_MS * 2,
    );
});
