// Staged paths that differ only by letter case, copied onto a file system that may fold case.
import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { rm, writeFile } from 'node:fs/promises';
import { gitOutput } from '#tests/harness/git.ts';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { pathExists } from '#tests/harness/preservation.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import type { CommandFailureJson } from '#cli/types/terminal.ts';

test('staged paths preserve each spelling and its bytes, or refuse a case-folding file system', async () => {
    await using sandbox = await testdir();
    await writeFile(join(sandbox.path, '.case-probe'), 'probe');
    const caseFolding = await pathExists(join(sandbox.path, '.CASE-PROBE'));
    await rm(join(sandbox.path, '.case-probe'));
    const check = {
        command: [
            process.execPath,
            '-e',
            'console.log(JSON.stringify(process.argv.slice(1).map(file => ({file,message:require("node:fs").readFileSync(file,"utf8")})))); process.exitCode = 1;',
            '{files}',
        ],
        output: { format: 'json', fields: { file: 'file', message: 'message' } },
        paths: ['docs/**'],
        stage: 'commit',
    };
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({
            configurations: [],
            agent_rules: { enabled: false },
            check: { 'sandbox/report': check },
        }),
        'docs/guide.md': '# Guide\n',
    });
    gitOutput(sandbox.path, ['init', '-q']);
    gitOutput(sandbox.path, ['add', '-A']);
    gitOutput(sandbox.path, ['commit', '-qm', 'base']);
    for (const [path, text] of [
        ['docs/Notes.md', '# Notes\n'],
        ['docs/NOTES.md', '# NOTES\n'],
    ]) {
        await writeFile(join(sandbox.path, '.git', 'staged-blob'), text!);
        const hash = gitOutput(sandbox.path, ['hash-object', '-w', '.git/staged-blob']);
        gitOutput(sandbox.path, ['update-index', '--add', '--cacheinfo', `100644,${hash},${path!}`]);
    }
    const result = await runGspot(sandbox.path, ['check', '--staged', '--only', 'sandbox/report', '--json']);
    if (!caseFolding) {
        expect(result.code, result.stdout + result.stderr).toBe(1);
        const report = JSON.parse(result.stdout) as RunReport;
        expect(report.checks.map((entry) => [entry.check, entry.status, entry.fileCount])).toStrictEqual([
            ['sandbox/report', 'failed', 2],
        ]);
        expect(
            Object.fromEntries(
                report.checks.flatMap(({ findings }) => findings.map(({ file, message }) => [file, message])),
            ),
        ).toStrictEqual({ 'docs/Notes.md': '# Notes\n', 'docs/NOTES.md': '# NOTES\n' });
        return;
    }
    expect(result.code, result.stdout + result.stderr).toBe(2);
    const failure = JSON.parse(result.stdout) as CommandFailureJson;
    expect(failure).toStrictEqual({ error: 'selection', message: expect.stringContaining('docs/NOTES.md') as string });
});
