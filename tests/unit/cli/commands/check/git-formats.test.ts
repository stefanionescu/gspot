import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { readGitOutput } from '#tests/setup/git.ts';
import { type PushReport } from '#cli/types/commands/check.ts';
import { buildReportingCheck } from '#tests/setup/settings.ts';
import { runGspot, checkReport } from '#tests/setup/run-gspot.ts';

// The files a check reports and the status it ends with, for a staged run and for a push of the same change.
async function collectVerdicts(format: 'sha1' | 'sha256'): Promise<unknown> {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({
            configurations: [],
            rules: { enabled: false },
            command_check: [{ ...buildReportingCheck({ name: 'sandbox/report', paths: ['src/**'], stage: 'commit' }) }],
        }),
        'src/kept.ts': 'export {};\n',
    });
    readGitOutput(sandbox.path, ['init', '-q', `--object-format=${format}`]);
    readGitOutput(sandbox.path, ['add', '-A']);
    readGitOutput(sandbox.path, ['commit', '-qm', 'base']);
    const base = readGitOutput(sandbox.path, ['rev-parse', 'HEAD']);
    await writeFile(join(sandbox.path, 'src/changed.ts'), 'export const changed = 1;\n');
    readGitOutput(sandbox.path, ['add', 'src/changed.ts']);
    const staged = await checkReport(sandbox.path, ['check', '--only', 'sandbox/report', '--staged', '--json']);
    const stagedReport = staged.report;
    readGitOutput(sandbox.path, ['commit', '-qm', 'change']);
    const head = readGitOutput(sandbox.path, ['rev-parse', 'HEAD']);
    readGitOutput(sandbox.path, ['update-ref', 'refs/remotes/origin/main', base]);
    const pushed = await runGspot(
        sandbox.path,
        ['check', '--hook', 'pre-push', '--only', 'sandbox/report', '--json', '--', 'origin'],
        {},
        { stdin: `refs/heads/main ${head} refs/heads/main ${base}\n` },
    );
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
    const expected = await collectVerdicts('sha1');
    expect(expected).toStrictEqual({ staged: [1, [['failed', ['src/changed.ts']]]], pushed: [1, [['failed']]] });
    expect(await collectVerdicts('sha256')).toStrictEqual(expected);
});
