import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { executeRun } from '#cli/execution/run.ts';
import { openSession } from '#cli/commands/session.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { CHECK_FUNCTIONS } from '#cli/checks/built-in.ts';
import { buildRunOptions } from '#tests/setup/run-gspot.ts';
import { buildCheckInput } from '#tests/setup/check-input.ts';
import { containing, textContaining } from '#tests/setup/matchers.ts';

test('gspot/settings validates captured gspot.toml and follows ordinary stage selection', async () => {
    const text = settingsText([]);
    await using sandbox = await testdir({ 'gspot.toml': text });
    const session = await openSession(sandbox.path);
    for (const stage of ['all', 'commit'] as const) {
        const result = await executeRun(session, buildRunOptions({ stage, only: ['gspot/settings'] }));
        expect(result.report.exitCode).toBe(0);
        expect(result.report.checks).toMatchObject([{ check: 'gspot/settings', status: 'passed', findings: [] }]);
        expect(result.report.checks).toHaveLength(1);
    }
    const message = await executeRun(session, buildRunOptions({ stage: 'message', only: ['gspot/settings'] }));
    expect(message.report.checks).toStrictEqual([]);
    const invalid = `${text}\nunknown_setting = true\n`;
    const input = buildCheckInput(session, 'gspot/settings');
    const findings = CHECK_FUNCTIONS['gspot/settings']({
        ...input,
        settingsFile: { ...input.settingsFile, text: invalid },
    });
    expect(findings).toContainEqual(
        containing({
            check: 'gspot/settings',
            file: 'gspot.toml',
            rule: 'settings',
            message: textContaining('unknown_setting'),
            fixable: false,
        }),
    );
    await Bun.write(join(sandbox.path, 'gspot.toml'), invalid);
    expect(openSession(sandbox.path)).rejects.toMatchObject({ code: 'settings' });
});
