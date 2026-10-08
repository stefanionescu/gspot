import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runGspot } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { commitAll, markExecutable } from '#tests/harness/git.ts';

import {
    SAFETY_SOURCES,
    SUCCESS_SOURCE,
    NAMED_PATHS_SOURCE,
    RIGHT_CLEANUP_SOURCE,
    WRONG_CLEANUP_SOURCE,
} from '#tests/config/cli/checks/language/bash/safety.ts';

test.each(SAFETY_SOURCES)(
    'a cleanup exemption retains unrelated recursive removal findings in $source',
    async ({ source, unsafeLines }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildPolicy(['bash']),
            'source.sh': '#!/usr/bin/env bash\nset -euo pipefail\n' + source,
        });
        const result = await runGspot(sandbox.path, ['check', '--only', 'bash/safety', '--json']);
        expect(result.code, result.stdout + result.stderr).toBe(unsafeLines.length === 0 ? 0 : 1);
        expect(
            (JSON.parse(result.stdout) as RunReport).checks[0]?.findings.map(({ file, line, rule }) => ({
                file,
                line,
                rule,
            })),
        ).toStrictEqual(unsafeLines.map((line) => ({ file: 'source.sh', line, rule: 'recursive-remove' })));
    },
);

test.each(['recommended', 'all'] as const)(
    '%s applies failure-discard coverage directly from the level and accepts project path names',
    async (level) => {
        await using sandbox = await testdir({
            'gspot.toml': buildPolicy(['bash'], { level }),
            'source.sh': SUCCESS_SOURCE,
        });
        const command = ['check', '--only', 'bash/safety', '--json'];
        const failure = await runGspot(sandbox.path, command);
        expect(failure.code, failure.stdout + failure.stderr).toBe(level === 'all' ? 1 : 0);
        expect((JSON.parse(failure.stdout) as RunReport).checks[0]?.findings.map(({ rule }) => rule)).toStrictEqual(
            level === 'all' ? ['blanket-success'] : [],
        );
        await Bun.write(join(sandbox.path, 'source.sh'), NAMED_PATHS_SOURCE);
        const paths = await runGspot(sandbox.path, command);
        expect(paths.code, paths.stdout + paths.stderr).toBe(0);
        expect((JSON.parse(paths.stdout) as RunReport).checks[0]).toMatchObject({ status: 'passed', findings: [] });
    },
);

test('the Bash contract and safety agree on the specific temporary path that a trap removes', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(['bash'], { level: 'all' }),
        'source.sh': WRONG_CLEANUP_SOURCE,
    });
    commitAll(sandbox.path);
    await markExecutable(sandbox.path, 'source.sh');
    const command = ['check', '--only', 'bash/contract', 'bash/safety', '--json'];
    const wrong = await runGspot(sandbox.path, command);
    expect(wrong.code, wrong.stdout + wrong.stderr).toBe(1);
    expect(
        (JSON.parse(wrong.stdout) as RunReport).checks.flatMap(({ findings }) =>
            findings.map(({ rule, line }) => ({ rule, line })),
        ),
    ).toStrictEqual([
        { rule: 'mktemp-trap', line: 3 },
        { rule: 'recursive-remove', line: 4 },
    ]);
    await Bun.write(join(sandbox.path, 'source.sh'), RIGHT_CLEANUP_SOURCE);
    const corrected = await runGspot(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(
        (JSON.parse(corrected.stdout) as RunReport).checks.map(({ status, findings }) => ({ status, findings })),
    ).toStrictEqual([
        { status: 'passed', findings: [] },
        { status: 'passed', findings: [] },
    ]);
});
