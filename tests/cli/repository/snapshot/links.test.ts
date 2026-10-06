// Tracked symbolic links that point anywhere: the staged and push checks copy them and judge the files alone.
import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { gitOutput } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import type { PushReport } from '#cli/types/commands/check.ts';
import { runGspot, spawnGspot } from '#tests/harness/gspot.ts';
import type { RunReport } from '#cli/types/execution/runtime.ts';
import { LINKS } from '#tests/config/cli/repository/snapshot-links.ts';

// Adds each link to the index as Git stores it, so the test needs no link support from the file system.
function stageLinks(root: string): void {
    for (const [path, target] of Object.entries(LINKS)) {
        writeFileSync(join(root, '.git', 'link-target'), target);
        const hash = gitOutput(root, ['hash-object', '-w', '.git/link-target']);
        gitOutput(root, ['update-index', '--add', '--cacheinfo', `120000,${hash},${path}`]);
    }
}

async function linkSandbox(): Promise<Awaited<ReturnType<typeof testdir>>> {
    const sandbox = await testdir();
    const check = {
        name: 'sandbox/report',
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
        'gspot.toml': stringify({ configurations: [], agent_rules: { enabled: false }, check: [check] }),
        'src/source.ts': 'export {};\n',
    });
    gitOutput(sandbox.path, ['init', '-q']);
    gitOutput(sandbox.path, ['add', '-A']);
    gitOutput(sandbox.path, ['commit', '-qm', 'base']);
    return sandbox;
}

test('a staged check with tracked links of every kind exits by its findings alone', async () => {
    await using sandbox = await linkSandbox();
    stageLinks(sandbox.path);
    await Bun.write(`${sandbox.path}/src/source.ts`, 'export const changed = 1;\n');
    gitOutput(sandbox.path, ['add', 'src/source.ts']);
    const result = await runGspot(sandbox.path, ['check', '--only', 'sandbox/report', '--staged', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(1);
    const report = JSON.parse(result.stdout) as RunReport;
    expect(report.checks.map((check) => [check.check, check.status])).toStrictEqual([['sandbox/report', 'failed']]);
});

test('a push of a commit with tracked links of every kind exits by its findings alone', async () => {
    await using sandbox = await linkSandbox();
    const base = gitOutput(sandbox.path, ['rev-parse', 'HEAD']);
    stageLinks(sandbox.path);
    await Bun.write(`${sandbox.path}/src/source.ts`, 'export const changed = 1;\n');
    gitOutput(sandbox.path, ['add', 'src/source.ts']);
    gitOutput(sandbox.path, ['commit', '-qm', 'links']);
    const head = gitOutput(sandbox.path, ['rev-parse', 'HEAD']);
    gitOutput(sandbox.path, ['update-ref', 'refs/remotes/origin/main', base]);
    const result = await spawnGspot(
        sandbox.path,
        ['check', '--only', 'sandbox/report', '--hook', 'pre-push', '--json', '--', 'origin', 'unused'],
        {},
        {
            stdin: `refs/heads/main ${head} refs/heads/main ${base}\n`,
        },
    );
    expect(result.code, result.stdout + result.stderr).toBe(1);
    const report = JSON.parse(result.stdout) as PushReport;
    expect(report.revisions[0]?.report.checks.map((check) => [check.check, check.status])).toStrictEqual([
        ['sandbox/report', 'failed'],
    ]);
});
