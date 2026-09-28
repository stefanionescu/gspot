import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { rejection } from '#tests/support/expectations.ts';
import { commitAll, gitOutput } from '#tests/support/cli/git.ts';
import { fetchedRevisions } from '#cli/repository/revisions/refspecs.ts';

test.each(['+refs/heads/*/*:refs/remotes/example/*', '+refs/heads/*:refs/remotes/example/*/*', '^refs/heads/*/*'])(
    'fetch mapping %s rejects multiple wildcards before substitution and accepts a corrected mapping',
    async (mapping) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'source.txt': 'Fixture source.\n' });
        commitAll(sandbox.path);
        const revision = gitOutput(sandbox.path, ['rev-parse', 'HEAD']);
        gitOutput(sandbox.path, ['update-ref', 'refs/remotes/example/main', revision]);
        gitOutput(sandbox.path, ['config', 'remote.example.fetch', mapping]);
        expect(await rejection(fetchedRevisions(sandbox.path, 'example'))).toContain('check-ref-format');
        gitOutput(sandbox.path, [
            'config',
            '--replace-all',
            'remote.example.fetch',
            '+refs/heads/*:refs/remotes/example/*',
        ]);
        expect(await fetchedRevisions(sandbox.path, 'example')).toStrictEqual([revision]);
        gitOutput(sandbox.path, ['config', '--add', 'remote.example.fetch', '^refs/heads/main']);
        expect(await fetchedRevisions(sandbox.path, 'example')).toStrictEqual([]);
    },
);
