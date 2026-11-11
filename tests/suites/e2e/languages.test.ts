import { expect, test } from 'bun:test';

import { SWIFT_CHECK } from '#tests/config/e2e.ts';
import { parseCheckReport } from '#tests/setup/cli/commands.ts';
import { runCheckOnChanges } from '#tests/setup/cli/samples.ts';
import { initSandbox } from '#tests/setup/sandboxes/create.ts';
import { createGspotProject } from '#tests/setup/sandboxes/projects/gspot.ts';
import type { CheckSample, SampleFix, Sandbox } from '#tests/types/setup.ts';

async function assertInstalledCheck(sandbox: Sandbox, sample: CheckSample & { corrected: SampleFix }): Promise<void> {
    const failed = parseCheckReport(await runCheckOnChanges(sandbox, sample));
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(failed.report.checks.flatMap(({ findings }) => findings)).toMatchObject([sample.expected]);
    const passed = parseCheckReport(await runCheckOnChanges(sandbox, { ...sample.corrected, check: sample.check }));
    expect(passed.code, passed.stdout + passed.stderr).toBe(0);
}

test('gspot installed from npm runs the built-in Swift naming check, reports its finding, and passes after the fix', async () => {
    await using installation = await createGspotProject();
    await initSandbox(installation.online, { configurations: ['bash', 'python', 'swift'] });
    const level = await installation.online.run(installation.root, ['set', 'level', 'all']);
    expect(level.code, level.stdout + level.stderr).toBe(0);
    await assertInstalledCheck(installation.offline, SWIFT_CHECK);
});
