import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { rmSync, writeFileSync } from 'node:fs';
import { executeRun } from '#cli/run/execute.ts';
import { openSession } from '#cli/run/session.ts';
import { runBlocking } from '#cli/platform/spawn.ts';
import { indexedPaths } from '#cli/repository/tracked.ts';

function git(root: string, ...args: string[]): void {
    const result = runBlocking(['git', ...args], { cwd: root });
    expect(result.code, result.stderr).toBe(0);
}

test('the index keeps deleted tracked paths, encoded names, and excludes untracked files', async () => {
    const path = 'folder % café/file.env';
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { [path]: 'TOKEN=example', 'untracked.ts': 'export {};\n' });
    expect(indexedPaths(sandbox.path)).toEqual([]);
    git(sandbox.path, 'init', '-q');
    git(sandbox.path, 'add', '--', path);
    rmSync(join(sandbox.path, path));
    expect(indexedPaths(sandbox.path)).toEqual([path]);
});

test.each(['integrity/env-files', 'integrity/tracked-dependencies'])(
    '%s reports a failed index observation instead of a clean verdict',
    async (check) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\nconfigurations = ["secrets", "structure"]\n',
            '.env': 'TOKEN=example\n',
            'node_modules/example/source.js': 'export {};\n',
            'source.ts': 'export {};\n',
        });
        git(sandbox.path, 'init', '-q');
        git(sandbox.path, 'add', '.');
        const session = await openSession(sandbox.path);
        const options = {
            stage: 'all' as const,
            only: [check],
            skips: [],
            fix: false,
            isDryRun: true,
            noCache: true,
        };
        const found = await executeRun(session, options);
        expect(found.report.exitCode).toBe(1);
        expect(found.report.checks[0]!.status).toBe('fail');
        expect(found.report.checks[0]!.findings).toHaveLength(1);
        writeFileSync(join(sandbox.path, '.git/index'), 'corrupt index');
        const failed = await executeRun(session, options);
        expect(failed.report.exitCode).toBe(2);
        expect(failed.report.checks[0]!.status).toBe('error');
        expect(failed.report.checks[0]!.note).toContain('Git index listing failed');
    },
);
