import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { runChecks } from '#cli/commands/check/run.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { commitAll, markExecutable } from '#tests/setup/system/git.ts';
import { BASH_SANDBOX } from '#tests/config/checks/language/bash/sandbox.ts';
import { PASSED_BASH_RESULTS } from '#tests/config/checks/language/bash/samples.ts';
import { runCheckSample, expectedSummary, shareBashSandbox, buildSampleSummary } from '#tests/setup/cli/samples.ts';

import {
    SAFETY_SOURCES,
    BASH_SAFETY_CASES,
    RIGHT_CLEANUP_SOURCE,
    WRONG_CLEANUP_SOURCE,
} from '#tests/config/checks/language/bash/safety.ts';

const bashSandbox = shareBashSandbox();
test.each([...SAFETY_SOURCES])(
    'a recursive removal in the trap that cleans up a mktemp path passes, and any other is reported: $source',
    async ({ source, unsafeLines }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['bash']),
            'source.sh': '#!/usr/bin/env bash\nset -euo pipefail\n' + source,
        });
        const result = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['bash/safety'] }));

        expect(result.report.checks[0]?.findings.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual(
            unsafeLines.map((line) => ({ file: 'source.sh', line, rule: 'recursive-remove' })),
        );
    },
);
test('a trap that removes another path is reported by script-layout as mktemp-trap and by safety as recursive-remove, and the right trap passes both', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash'], { level: 'all' }),
        'source.sh': WRONG_CLEANUP_SOURCE,
    });
    commitAll(sandbox.path);
    await markExecutable(sandbox.path, 'source.sh');

    const wrong = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['bash/script-layout', 'bash/safety'] }),
    );

    expect(
        wrong.report.checks.flatMap(({ findings }) => findings.map(({ rule, line }) => ({ rule, line }))),
    ).toStrictEqual([
        { rule: 'mktemp-trap', line: 3 },
        { rule: 'recursive-remove', line: 4 },
    ]);
    await writeFile(join(sandbox.path, 'source.sh'), RIGHT_CLEANUP_SOURCE);
    const corrected = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['bash/script-layout', 'bash/safety'] }),
    );

    expect(corrected.report.checks.map(({ status, findings }) => ({ status, findings }))).toStrictEqual(
        PASSED_BASH_RESULTS,
    );
});

test.each([...BASH_SAFETY_CASES])('$check reports $expected.rule and passes after the fix', async (sample) => {
    const result = await runCheckSample(bashSandbox(), sample, BASH_SANDBOX);
    expect(buildSampleSummary(result)).toStrictEqual(expectedSummary(sample));
});
