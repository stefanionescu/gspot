import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { rejection } from '#tests/harness/expectations.ts';
import { commitAll, gitOutput } from '#tests/harness/git.ts';
import { selectPush } from '#cli/repository/revisions/push.ts';

test('a fetch mapping with two wildcards is refused before substitution and a corrected mapping is accepted', async () => {
    const mapping = '+refs/heads/*/*:refs/remotes/example/*';
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'source.txt': 'Fixture source.\n' });
    commitAll(sandbox.path);
    const revision = gitOutput(sandbox.path, ['rev-parse', 'HEAD']);
    const input = `refs/heads/main ${revision} refs/heads/main ${'0'.repeat(revision.length)}\n`;
    gitOutput(sandbox.path, ['update-ref', 'refs/remotes/example/main', revision]);
    gitOutput(sandbox.path, ['config', 'remote.example.fetch', mapping]);
    expect(await rejection(selectPush(sandbox.path, input, 'example'))).toContain(
        `Invalid fetch mapping for example: ${mapping}`,
    );
    gitOutput(sandbox.path, [
        'config',
        '--replace-all',
        'remote.example.fetch',
        '+refs/heads/*:refs/remotes/example/*',
    ]);
    const fetched = await selectPush(sandbox.path, input, 'example');
    expect(fetched.skipped).toStrictEqual([]);
    expect(
        fetched.revisions.map(({ object: revision, commits, paths }) => ({ object: revision, commits, paths })),
    ).toStrictEqual([{ object: revision, commits: [], paths: [] }]);
    gitOutput(sandbox.path, ['config', '--add', 'remote.example.fetch', '^refs/heads/main']);
    const excluded = await selectPush(sandbox.path, input, 'example');
    expect(excluded.skipped).toStrictEqual([]);
    expect(
        excluded.revisions.map(({ object: revision, commits, paths }) => ({ object: revision, commits, paths })),
    ).toStrictEqual([{ object: revision, commits: [revision], paths: undefined }]);
});
