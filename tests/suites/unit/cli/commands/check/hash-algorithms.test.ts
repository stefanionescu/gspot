import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { stringify } from '@decimalturn/toml-patch';
import { runGitStep } from '#tests/setup/system/git.ts';
import { type PushReport } from '#cli/types/commands/check.ts';
import { runGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { buildReportingCheck, buildSandboxSettings } from '#tests/setup/cli/settings.ts';

async function runChangeChecks(format: 'sha1' | 'sha256'): Promise<unknown> {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([], {
            tables: stringify({
                command_check: [buildReportingCheck({ id: 'sandbox/report', paths: ['src/**'], stage: 'commit' })],
            }),
        }),
        'src/kept.ts': 'export {};\n',
    });

    runGitStep(sandbox.path, ['init', '-q', `--object-format=${format}`]);
    runGitStep(sandbox.path, ['add', '-A']);
    runGitStep(sandbox.path, ['commit', '-qm', 'base']);
    const base = runGitStep(sandbox.path, ['rev-parse', 'HEAD']);
    await writeFile(join(sandbox.path, 'src/changed.ts'), 'export const changed = 1;\n');
    runGitStep(sandbox.path, ['add', 'src/changed.ts']);
    const staged = parseCheckReport(
        await runGspot(sandbox.path, ['check', '--only', 'sandbox/report', '--staged', '--json']),
    );
    runGitStep(sandbox.path, ['commit', '-qm', 'change']);
    const head = runGitStep(sandbox.path, ['rev-parse', 'HEAD']);
    runGitStep(sandbox.path, ['update-ref', 'refs/remotes/origin/main', base]);
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
            staged.report.checks.map((check) => [check.status, check.findings.map((finding) => finding.message)]),
        ],
        pushed: [
            pushed.code,
            pushReport.revisions.map((revision) => revision.report.checks.map((result) => result.status)),
        ],
    };
}

test('SHA-256 object names give the staged and push checks the results of SHA-1 names', async () => {
    const expected = await runChangeChecks('sha1');
    expect(expected).toStrictEqual({ staged: [1, [['failed', ['src/changed.ts']]]], pushed: [1, [['failed']]] });
    expect(await runChangeChecks('sha256')).toStrictEqual(expected);
});
