// A repository with SHA-256 object names gets the same staged and push verdicts as one with SHA-1 names.
import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { gitOutput } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import type { PushReport } from '#cli/types/commands/check.ts';
import { runGspot, checkReport } from '#tests/harness/gspot.ts';

// The files a check reports and the status it ends with, for a staged run and for a push of the same change.
async function verdicts(format: 'sha1' | 'sha256'): Promise<unknown> {
    await using sandbox = await testdir();
    const check = {
        command: [
            process.execPath,
            '-e',
            'process.argv.slice(1).forEach((path) => console.log(path)); process.exitCode = 1;',
            '{files}',
        ],
        paths: ['src/**'],
        stage: 'commit',
        output: { format: 'lines' },
    };
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({
            configurations: [],
            agent_rules: { enabled: false },
            check: { 'sandbox/report': check },
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
    gitOutput(sandbox.path, ['update-ref', 'refs/remotes/origin/main', base]);
    const pushed = await runGspot(
        sandbox.path,
        ['check', '--only', 'sandbox/report', '--hook', 'pre-push', '--json', '--', 'origin', 'unused'],
        {},
        {
            stdin: `refs/heads/main ${head} refs/heads/main ${base}\n`,
        },
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

test('SHA-256 object names give the staged and push checks the verdicts of SHA-1 names', async () => {
    const expected = await verdicts('sha1');
    expect(expected).toStrictEqual({ staged: [1, [['failed', ['src/changed.ts']]]], pushed: [1, [['failed']]] });
    expect(await verdicts('sha256')).toStrictEqual(expected);
});
