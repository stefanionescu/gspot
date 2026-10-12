import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runBashSamples } from '#tests/setup/fixes.ts';
import { checkReport } from '#tests/setup/run-gspot.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { commitAll, markExecutable } from '#tests/setup/git.ts';

import {
    SAFETY_SOURCES,
    BASH_SAFETY_CASES,
    WRONG_CLEANUP_SOURCE,
    RIGHT_CLEANUP_SOURCE,
} from '#tests/config/bash/safety.ts';

runBashSamples(BASH_SAFETY_CASES);

test.each([...SAFETY_SOURCES])(
    'a trap that removes its own temporary file is allowed and other recursive removals are reported: $source',
    async ({ source, unsafeLines }) => {
        await using sandbox = await testdir({
            'gspot.toml': settingsText(['bash']),
            'source.sh': '#!/usr/bin/env bash\nset -euo pipefail\n' + source,
        });
        const result = await checkReport(sandbox.path, ['check', '--only', 'bash/safety', '--json']);
        expect(result.code, result.stdout + result.stderr).toBe(unsafeLines.length === 0 ? 0 : 1);
        expect(result.report.checks[0]?.findings.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual(
            unsafeLines.map((line) => ({ file: 'source.sh', line, rule: 'recursive-remove' })),
        );
    },
);

test('the Bash contract and safety agree on the specific temporary path that a trap removes', async () => {
    await using sandbox = await testdir({
        'gspot.toml': settingsText(['bash'], { level: 'all' }),
        'source.sh': WRONG_CLEANUP_SOURCE,
    });
    commitAll(sandbox.path);
    await markExecutable(sandbox.path, 'source.sh');
    const command = ['check', '--only', 'bash/script-layout', 'bash/safety', '--json'];
    const wrong = await checkReport(sandbox.path, command);
    expect(wrong.code, wrong.stdout + wrong.stderr).toBe(1);
    expect(
        wrong.report.checks.flatMap(({ findings }) => findings.map(({ rule, line }) => ({ rule, line }))),
    ).toStrictEqual([
        { rule: 'mktemp-trap', line: 3 },
        { rule: 'recursive-remove', line: 4 },
    ]);
    await Bun.write(join(sandbox.path, 'source.sh'), RIGHT_CLEANUP_SOURCE);
    const corrected = await checkReport(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks.map(({ status, findings }) => ({ status, findings }))).toStrictEqual([
        { status: 'passed', findings: [] },
        { status: 'passed', findings: [] },
    ]);
});
