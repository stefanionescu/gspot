import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { gitOutput } from '#tests/setup/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { reportingCheck } from '#tests/setup/settings.ts';
import type { PushReport } from '#cli/types/commands/check.ts';
import { runPrePush, checkReport } from '#tests/setup/run-gspot.ts';

// The files a check reports and the status it ends with, for a staged run and for a push of the same change.
async function verdicts(format: 'sha1' | 'sha256'): Promise<unknown> {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({
            configurations: [],
            rules: { enabled: false },
            command_check: [{ ...reportingCheck({ name: 'sandbox/report', paths: ['src/**'], stage: 'commit' }) }],
        }),
        'src/kept.ts': 'export {};\n',
    });
    gitOutput(sandbox.path, ['init', '-q', `--object-format=${format}`]);
    gitOutput(sandbox.path, ['add', '-A']);
    gitOutput(sandbox.path, ['commit', '-qm', 'base']);
    const base = gitOutput(sandbox.path, ['rev-parse', 'HEAD']);
    await writeFile(join(sandbox.path, 'src/changed.ts'), 'export const changed = 1;\n');
    gitOutput(sandbox.path, ['add', 'src/changed.ts']);
    const staged = await checkReport(sandbox.path, ['check', '--only', 'sandbox/report', '--staged', '--json']);
    const stagedReport = staged.report;
    gitOutput(sandbox.path, ['commit', '-qm', 'change']);
    const head = gitOutput(sandbox.path, ['rev-parse', 'HEAD']);
    const pushed = await runPrePush(sandbox.path, base, head, ['sandbox/report']);
    const pushReport = JSON.parse(pushed.stdout) as PushReport;
    return {
        staged: [
            staged.code,
            stagedReport.checks.map((entry) => [entry.status, entry.findings.map((finding) => finding.message)]),
        ],
        pushed: [
            pushed.code,
            pushReport.revisions.map((revision) => revision.report.checks.map((entry) => entry.status)),
        ],
    };
}

test('SHA-256 object names give the staged and push checks the results of SHA-1 names', async () => {
    const expected = await verdicts('sha1');
    expect(expected).toStrictEqual({ staged: [1, [['failed', ['src/changed.ts']]]], pushed: [1, [['failed']]] });
    expect(await verdicts('sha256')).toStrictEqual(expected);
});
