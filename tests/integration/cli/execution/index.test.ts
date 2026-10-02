import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { rmSync, writeFileSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import { gitOutput } from '#tests/harness/cli/git.ts';
import { executeRun } from '#cli/execution/execute.ts';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { indexedPaths } from '#cli/repository/tracked.ts';
import { runOptions } from '#tests/harness/cli/command.ts';

test('the index keeps deleted tracked paths, encoded names, and excludes untracked files', async () => {
    const path = 'folder % café/file.env';
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { [path]: 'TOKEN=example', 'untracked.ts': 'export {};\n' });
    expect(indexedPaths(sandbox.path)).toStrictEqual([]);
    gitOutput(sandbox.path, ['init', '-q']);
    gitOutput(sandbox.path, ['add', '--', path]);
    rmSync(join(sandbox.path, path));
    expect(indexedPaths(sandbox.path)).toStrictEqual([path]);
});

test.each(['secrets/env-files', 'structure/tracked-dependencies'])(
    '%s reports a failed index read instead of a clean verdict',
    async (check) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': policyOf(['secrets', 'structure']),
            '.env': 'TOKEN=example\n',
            'node_modules/example/source.js': 'export {};\n',
            'source.ts': 'export {};\n',
        });
        gitOutput(sandbox.path, ['init', '-q']);
        gitOutput(sandbox.path, ['add', '.']);
        const session = await openSession(sandbox.path);
        const options = runOptions({ only: [check], isDryRun: true });
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
