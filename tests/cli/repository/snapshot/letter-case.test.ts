// Staged paths that differ only by letter case, copied onto a file system that may fold case.
import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { gitOutput } from '#tests/harness/git.ts';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import type { CommandFailureJson } from '#cli/types/output.ts';
import type { RunReport } from '#cli/types/execution/runtime.ts';

test('a staged check over two spellings of one path passes or refuses with a selection error', async () => {
    await using sandbox = await testdir();
    const check = {
        name: 'sandbox/report',
        command: [process.execPath, '-e', 'process.exitCode = 0', '{files}'],
        paths: ['docs/**'],
        stage: 'commit',
    };
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({ configurations: [], agent_rules: { enabled: false }, check: [check] }),
        'docs/guide.md': '# Guide\n',
    });
    gitOutput(sandbox.path, ['init', '-q']);
    gitOutput(sandbox.path, ['add', '-A']);
    gitOutput(sandbox.path, ['commit', '-qm', 'base']);
    for (const [path, text] of [
        ['docs/Notes.md', '# Notes\n'],
        ['docs/NOTES.md', '# NOTES\n'],
    ]) {
        writeFileSync(join(sandbox.path, '.git', 'staged-blob'), text!);
        const hash = gitOutput(sandbox.path, ['hash-object', '-w', '.git/staged-blob']);
        gitOutput(sandbox.path, ['update-index', '--add', '--cacheinfo', `100644,${hash},${path!}`]);
    }
    const result = await runGspot(sandbox.path, ['check', '--staged', '--json']);
    if (result.code === 0) {
        const report = JSON.parse(result.stdout) as RunReport;
        expect(report.checks.map((entry) => [entry.check, entry.status])).toStrictEqual([['sandbox/report', 'passed']]);
        return;
    }
    expect(result.code, result.stdout + result.stderr).toBe(2);
    const failure = JSON.parse(result.stdout) as CommandFailureJson;
    expect(failure).toStrictEqual({ error: 'selection', message: expect.stringContaining('docs/NOTES.md') as string });
});
