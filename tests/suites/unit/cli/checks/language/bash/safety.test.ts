import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { runChecks } from '#cli/commands/check/run.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { BASH_SANDBOX } from '#tests/config/setup/sandboxes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { shareBashSandbox } from '#tests/setup/sandboxes/create.ts';
import { commitAll, markExecutable } from '#tests/setup/system/git.ts';
import { runCheckSample, expectedSummary } from '#tests/setup/cli/samples.ts';
import { BASH_SAFETY_CASES } from '#tests/config/checks/language/bash/safety.ts';
import { PASSED_BASH_RESULTS } from '#tests/config/checks/language/bash/samples.ts';

const bashSandbox = shareBashSandbox();

test('a recursive removal outside a mktemp cleanup trap is reported', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash']),
        'source.sh': '#!/usr/bin/env bash\nset -euo pipefail\nrm -rf /etc\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'bash/safety');
    expect(findings.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        { file: 'source.sh', line: 3, rule: 'recursive-remove' },
    ]);
});

test('a trap that removes another path is reported by script-layout as mktemp-trap and by safety as recursive-remove, and the right trap passes both', async () => {
    const RIGHT_CLEANUP_SOURCE = `#!/usr/bin/env bash
set -euo pipefail
tmp=$(mktemp -d)
trap 'rm -rf -- "$tmp"' EXIT
`;

    const WRONG_CLEANUP_SOURCE = `#!/usr/bin/env bash
set -euo pipefail
tmp=$(mktemp -d)
trap 'rm -rf /etc' EXIT
`;

    const options = buildRunOptions({ only: ['bash/script-layout', 'bash/safety'] });
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash'], { level: 'all' }),
        'source.sh': WRONG_CLEANUP_SOURCE,
    });
    commitAll(sandbox.path);
    await markExecutable(sandbox.path, 'source.sh');

    const wrong = await runChecks(await openSession(sandbox.path), options);

    expect(
        wrong.report.checks.flatMap(({ findings }) => findings.map(({ rule, line }) => ({ rule, line }))),
    ).toStrictEqual([
        { rule: 'mktemp-trap', line: 3 },
        { rule: 'recursive-remove', line: 4 },
    ]);
    await writeFile(join(sandbox.path, 'source.sh'), RIGHT_CLEANUP_SOURCE);
    const corrected = await runChecks(await openSession(sandbox.path), options);

    expect(corrected.report.checks).toMatchObject([...PASSED_BASH_RESULTS]);
});

test.each([...BASH_SAFETY_CASES])(
    '$check reports $expected.rule in $expected.file and passes after the fix',
    async (sample) => {
        expect(await runCheckSample(bashSandbox(), sample, BASH_SANDBOX.cleanSource)).toStrictEqual(
            expectedSummary(sample),
        );
    },
);
