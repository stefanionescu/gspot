import { testdir } from 'testdirs';
import { runChecks } from '#cli/runs/run.ts';
import { openSession } from '#cli/session.ts';
import { generate } from '#cli/generation/generate.ts';
import { buildRunOptions } from '#tests/setup/builders.ts';
import { test, expect, afterEach, setSystemTime } from 'bun:test';
import { EXPIRED_IGNORE_SETTINGS } from '#tests/data/checks/gspot/suppressions.ts';

afterEach(() => {
    setSystemTime();
});

test('an ignore past its until date stays in the generated files and gspot/suppressions reports it once, at its line', async () => {
    await using folder = await testdir({
        'gspot.toml': EXPIRED_IGNORE_SETTINGS,
        'sample.sh': '#!/usr/bin/env bash\nprintf "%s\\n" "$value"\n',
    });
    setSystemTime(new Date('2030-01-01T12:00:00Z'));
    const before = generate(await openSession(folder.path)).files;
    for (const timestamp of ['2030-01-02T00:00:00Z', '2030-01-03T12:00:00Z']) {
        setSystemTime(new Date(timestamp));
        const session = await openSession(folder.path);
        const after = generate(session).files;
        expect(after).toStrictEqual(before);
        expect(after.find((file) => file.path.endsWith('/shellcheckrc'))?.content).toContain('SC2086');
        const result = await runChecks(session, buildRunOptions({ stage: 'commit', only: ['gspot/suppressions'] }));
        expect(result.report.checks.flatMap(({ findings }) => findings)).toStrictEqual([
            {
                check: 'gspot/suppressions',
                file: 'gspot.toml',
                line: 4,
                rule: 'expired-ignore',
                message: 'This ignore of bash/shellcheck ended on 2030-01-02.',
                help: 'Fix the findings and delete the ignore with gspot unignore. To keep it, write a later until date in gspot.toml.',
                fixable: false,
            },
        ]);
    }
});
