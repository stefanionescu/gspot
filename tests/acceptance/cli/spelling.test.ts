import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { TYPO } from '#tests/harness/spelling.ts';
import { testdir, createFileTree } from 'testdirs';
import { commitAll } from '#tests/harness/cli/git.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { spawnGspot } from '#tests/harness/cli/command.ts';
import { containing } from '#tests/harness/expectations.ts';
import { toolsPath } from '#tests/harness/tools/install.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';

test(
    'spelling corrections return findings when an ambiguous word needs a manual choice',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': policyOf(['spelling'], '[rules]\ninstall = false\n'),
            'sample.txt': `${TYPO.the} ${TYPO.whether}\n`,
        });
        const environment = { PATH: toolsPath(['typos']) };
        const applied = await spawnGspot(sandbox.path, ['apply'], environment);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        commitAll(sandbox.path);
        const args = ['check', '--only', 'spelling/typos', '--json', '--fix'];
        for (const attempt of [0, 1]) {
            const checked = await spawnGspot(sandbox.path, args, environment);
            expect(checked.code, `Attempt ${String(attempt)}: ${checked.stdout}${checked.stderr}`).toBe(1);
            expect(readFileSync(join(sandbox.path, 'sample.txt'), 'utf8')).toBe(`the ${TYPO.whether}\n`);
            const report = JSON.parse(checked.stdout) as RunReport;
            expect(report.checks.flatMap((check) => check.findings)).toContainEqual(
                containing({ file: 'sample.txt', fixable: false }),
            );
        }
        await Bun.write(join(sandbox.path, 'sample.txt'), 'the whether\n');
        const corrected = await spawnGspot(sandbox.path, args, environment);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    },
    PLANTED_TIMEOUT_MS,
);
