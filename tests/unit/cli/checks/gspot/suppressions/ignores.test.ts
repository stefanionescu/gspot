import { testdir } from 'testdirs';
import { openSession } from '#cli/session.ts';
import { runChecks } from '#cli/commands/check/run.ts';
import { generate } from '#cli/generation/generate.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { test, expect, afterEach, setSystemTime } from 'bun:test';
import { EXPIRED_IGNORE_FINDINGS, EXPIRED_IGNORE_SETTINGS } from '#tests/data/checks/gspot/suppressions/ignores.ts';

afterEach(() => {
    setSystemTime();
});

test('an ignore past its until date stays in the generated files and gspot/suppressions reports it once, at its line', async () => {
    await using sandbox = await testdir({
        'gspot.toml': EXPIRED_IGNORE_SETTINGS,
        'sample.sh': '#!/usr/bin/env bash\nprintf "%s\\n" "$value"\n',
    });
    setSystemTime(new Date('2030-01-01T12:00:00Z'));
    const before = generate(await openSession(sandbox.path)).files;
    for (const timestamp of ['2030-01-02T00:00:00Z', '2030-01-03T12:00:00Z']) {
        setSystemTime(new Date(timestamp));
        const session = await openSession(sandbox.path);
        const after = generate(session).files;
        expect(after).toStrictEqual(before);
        expect(after.find((file) => file.path.endsWith('/shellcheckrc'))?.content).toContain('SC2086');
        const result = await runChecks(session, buildRunOptions({ stage: 'commit', only: ['gspot/suppressions'] }));
        expect(result.report.checks.flatMap(({ findings }) => findings)).toStrictEqual([...EXPIRED_IGNORE_FINDINGS]);
    }
});
