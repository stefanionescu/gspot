import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { commitAll } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { TYPO } from '#tests/config/samples/spelling.ts';
import { buildToolsPath } from '#tests/harness/install.ts';
import { containing } from '#tests/harness/expectations.ts';
import type { RunReport } from '#cli/types/execution/check.ts';

test('spelling corrections return findings when an ambiguous word needs a manual choice', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['spelling'], { tables: '[agent_rules]\nenabled = false\n' }),
        'sample.txt': `${TYPO.the} ${TYPO.whether}\n`,
    });
    const environment = { PATH: buildToolsPath(['typos']) };
    const applied = await spawnGspot(sandbox.path, ['apply'], environment);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    commitAll(sandbox.path);
    const args = ['check', '--only', 'spelling/typos', '--json', '--fix'];
    for (const attempt of [0, 1]) {
        const checked = await spawnGspot(sandbox.path, args, environment);
        expect(checked.code, `Attempt ${String(attempt)}: ${checked.stdout}${checked.stderr}`).toBe(1);
        expect(await readFile(join(sandbox.path, 'sample.txt'), 'utf8')).toBe(`the ${TYPO.whether}\n`);
        const report = JSON.parse(checked.stdout) as RunReport;
        expect(report.checks.flatMap((check) => check.findings)).toContainEqual(
            containing({ file: 'sample.txt', fixable: false }),
        );
    }
    await Bun.write(join(sandbox.path, 'sample.txt'), 'the whether\n');
    const corrected = await spawnGspot(sandbox.path, args, environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});
