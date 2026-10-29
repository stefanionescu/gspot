import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { pathToFileURL } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
import { captureRejection } from '#tests/setup/matchers.ts';
import { PUSH_CONTENT } from '#tests/config/setup/sandboxes.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { MERGE_BASE_FAILURE } from '#tests/config/repository/revisions.ts';
import { readPushedCommits, readPushedRevisions } from '#cli/repository/revisions/push.ts';

import {
    createGitSandbox,
    preparePushRepository,
    prepareNestedRepository,
} from '#tests/setup/sandboxes/repositories.ts';

test('push comparison tells a missing upstream from an upstream whose commit is gone', async () => {
    await using sandbox = await testdir({ 'source.ts': 'export {};\n' });

    commitAll(sandbox.path);
    expect(await readPushedCommits(sandbox.path)).toStrictEqual([]);
    await writeFile(join(sandbox.path, 'source.ts'), 'export const changed = true;\n');
    runGitStep(sandbox.path, ['add', '.']);
    runGitStep(sandbox.path, ['commit', '-qm', 'Second']);
    runGitStep(sandbox.path, ['branch', 'upstream']);
    runGitStep(sandbox.path, ['branch', '--set-upstream-to=upstream']);
    expect(await readPushedCommits(sandbox.path)).toStrictEqual([]);
    runGitStep(sandbox.path, ['update-ref', '-d', 'refs/heads/upstream']);
    const error = await captureRejection(readPushedCommits(sandbox.path));
    expect(error.message).toStartWith(MERGE_BASE_FAILURE);
});

test('push comparison reports an unborn or broken HEAD instead of inventing a base', async () => {
    await using sandbox = await createGitSandbox({ 'source.ts': 'export {};\n' });

    expect(await readPushedCommits(sandbox.path)).toStrictEqual([]);
    commitAll(sandbox.path);
    await writeFile(join(sandbox.path, '.git/HEAD'), 'broken head');
    const historyError = await captureRejection(readPushedCommits(sandbox.path));
    expect(historyError.message).toContain('Cannot read committed Git history');
});

test.each(['origin', undefined, 'file:///unused', '/unused'] as const)(
    'the pre-push remote %p picks the remote-tracking branch that a new branch compares with',
    async (remote) => {
        await using sandbox = await testdir();
        const { base, reviewed, broken, zero } = await preparePushRepository(sandbox.path);
        runGitStep(sandbox.path, ['remote', 'add', 'origin', 'unused']);
        for (const [name, commit] of [
            ['origin', base],
            ['other', reviewed],
        ] as const)
            runGitStep(sandbox.path, ['update-ref', `refs/remotes/${name}/main`, commit]);
        const protocol = `refs/heads/reviewed ${reviewed} refs/heads/new ${zero}\n`;
        const selected = await readPushedRevisions(sandbox.path, protocol, remote);
        expect(selected.revisions[0]?.commits).toStrictEqual(remote === 'origin' ? [reviewed] : []);
        expect(selected.revisions[0]?.paths).toStrictEqual(remote === 'origin' ? ['changed.sh'] : []);
        expect(runGitStep(sandbox.path, ['rev-parse', 'HEAD'])).toBe(broken);
        for (const [path, content] of [
            ['gspot.toml', PUSH_CONTENT.settings],
            ['changed.sh', PUSH_CONTENT.working],
        ] as const)
            expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(content);
    },
);

test('a shallow clone reports incomplete history and skips commits the remote already has', async () => {
    await using sandbox = await testdir();
    const source = join(sandbox.path, 'source');
    const { base, reviewed } = await preparePushRepository(source);
    const branch = runGitStep(source, ['branch', '--show-current']);
    runGitStep(sandbox.path, [
        'clone',
        '--quiet',
        '--depth=1',
        '--branch',
        'reviewed',
        pathToFileURL(source).href,
        'checkout',
    ]);
    const checkout = join(sandbox.path, 'checkout');
    runGitStep(checkout, ['remote', 'add', 'unseen', pathToFileURL(source).href]);
    const protocol = `refs/heads/reviewed ${reviewed} refs/heads/new ${'0'.repeat(reviewed.length)}\n`;
    const unobserved = await readPushedRevisions(checkout, protocol, 'unseen');
    expect(unobserved.revisions[0]).toMatchObject({ commits: [reviewed], shallow: true });
    expect(unobserved.revisions[0]?.paths).toStrictEqual(['changed.sh', 'gspot.toml', 'legacy.sh']);
    const advertised = await readPushedRevisions(checkout, protocol);
    expect(advertised.revisions[0]).toMatchObject({ commits: [], paths: [], shallow: false });
    runGitStep(checkout, ['fetch', '--unshallow']);
    const unseen = await readPushedRevisions(checkout, protocol, 'unseen');
    expect(unseen.revisions[0]).toMatchObject({ commits: [reviewed, base], shallow: false });
    expect(runGitStep(source, ['branch', '--show-current'])).toBe(branch);
});

test('a gspot.toml below the Git root keeps paths relative to its folder for updated and new branches', async () => {
    await using sandbox = await testdir();
    const { project, base, commitId } = await prepareNestedRepository(sandbox.path);
    expect(
        runGitStep(sandbox.path, ['diff', '--name-status', base, commitId, '--', 'nested settings/source.txt']),
    ).toBe('M\tnested settings/source.txt');
    const protocol = `refs/heads/main ${commitId} refs/heads/main ${base}\n`;
    const updated = await readPushedRevisions(project, protocol);
    expect(updated.revisions[0]?.paths).toStrictEqual(['source.txt']);
    runGitStep(sandbox.path, ['config', 'remote.example.fetch', '+refs/heads/*:refs/remotes/example/*']);
    runGitStep(sandbox.path, ['update-ref', 'refs/remotes/example/main', base]);
    const createdRef = `refs/heads/new ${commitId} refs/heads/new ${'0'.repeat(commitId.length)}\n`;
    const created = await readPushedRevisions(project, createdRef, 'example');
    expect(created.revisions[0]?.paths).toStrictEqual(['source.txt']);
    expect(await readFile(join(project, 'source.txt'), 'utf8')).toBe('working');
});
