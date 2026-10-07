import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { gitOutput } from '#tests/harness/git.ts';
import { executeRun } from '#cli/execution/run.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { buildRunOptions } from '#tests/harness/gspot.ts';
import { getStaged } from '#cli/repository/revisions/changes.ts';

test.each(['secrets/env-files', 'structure/tracked-dependencies'])(
    '%s reports a failed index read instead of a clean verdict',
    async (check) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['secrets', 'structure']),
            '.env': 'TOKEN=example\n',
            'node_modules/example/source.js': 'export {};\n',
            'source.ts': 'export {};\n',
        });
        gitOutput(sandbox.path, ['init', '-q']);
        gitOutput(sandbox.path, ['add', '.']);
        const session = await openSession(sandbox.path);
        const options = buildRunOptions({ only: [check], isDryRun: true });
        const found = await executeRun(session, options);
        expect(found.report.exitCode).toBe(1);
        expect(found.report.checks[0]!.status).toBe('failed');
        expect(found.report.checks[0]!.findings).toMatchObject([
            { file: check === 'secrets/env-files' ? '.env' : 'node_modules' },
        ]);
        writeFileSync(join(sandbox.path, '.git/index'), 'corrupt index');
        const failed = await executeRun(session, options);
        expect(failed.report.exitCode).toBe(2);
        expect(failed.report.checks[0]!.status).toBe('error');
        expect(failed.report.checks[0]!.note).toContain('Git ls-files failed');
    },
);

test('execution reports the unstaged selection count before command rendering', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['secrets']),
        '.env': 'TOKEN=example\n',
        'source.ts': 'export {};\n',
    });
    gitOutput(sandbox.path, ['init', '-q']);
    gitOutput(sandbox.path, ['add', '.']);
    writeFileSync(join(sandbox.path, 'source.ts'), 'export const value = 1;\n');
    const selection = await getStaged(sandbox.path);
    const options = buildRunOptions({
        only: ['secrets/env-files'],
        staged: selection.staged,
        unstagedChanges: selection.unstaged,
    });
    const outcome = await executeRun(await openSession(sandbox.path), options);
    expect(outcome.report.unstagedChanges).toBe(1);
    expect(outcome.report.partial).toBe(true);
    expect(outcome.report.exitCode).toBe(1);
    expect(outcome.report.checks[0]?.status).toBe('failed');
    expect(outcome.report.checks[0]?.findings[0]?.file).toBe('.env');
});
