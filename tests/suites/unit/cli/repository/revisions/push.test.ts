import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { readPushedCommits, readPushedRevisions } from '#cli/repository/revisions/push.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import {
    createGitSandbox,
    prepareNestedRepository,
    preparePushRepository,
} from '#tests/setup/sandboxes/repositories.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';

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
    expect(error).toMatchObject({ name: 'GspotError', code: 'arguments' });
    expect(error.message).toContain('refs/heads/upstream');
});

test('push comparison of an unborn HEAD has no commits, and a broken HEAD is a Git error instead of a base', async () => {
    await using sandbox = await createGitSandbox({ 'source.ts': 'export {};\n' });

    expect(await readPushedCommits(sandbox.path)).toStrictEqual([]);
    await writeFile(join(sandbox.path, '.git/HEAD'), 'broken\n');
    expect(await captureRejection(readPushedCommits(sandbox.path))).toMatchObject({ name: 'GspotError', code: 'git' });
});

test.each(['origin', undefined, 'file:///unused'] as const)(
    'the pre-push remote %p picks the remote-tracking branch that a new branch compares with',
    async (remote) => {
        await using sandbox = await testdir();
        const { base, reviewed, zero } = await preparePushRepository(sandbox.path);
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
    },
);

test('a shallow clone reports incomplete history and skips commits the remote already has', async () => {
    await using sandbox = await testdir();
    const source = join(sandbox.path, 'source');
    const { base, reviewed } = await preparePushRepository(source);
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
});

test('a gspot.toml below the Git root keeps paths relative to its folder for updated and new branches', async () => {
    await using sandbox = await testdir();
    const { project, base, commitId } = await prepareNestedRepository(sandbox.path);
    const protocol = `refs/heads/main ${commitId} refs/heads/main ${base}\n`;
    const updated = await readPushedRevisions(project, protocol);
    expect(updated.revisions[0]?.paths).toStrictEqual(['source.txt']);
    runGitStep(sandbox.path, ['config', 'remote.example.fetch', '+refs/heads/*:refs/remotes/example/*']);
    runGitStep(sandbox.path, ['update-ref', 'refs/remotes/example/main', base]);
    const createdRef = `refs/heads/new ${commitId} refs/heads/new ${'0'.repeat(commitId.length)}\n`;
    const created = await readPushedRevisions(project, createdRef, 'example');
    expect(created.revisions[0]?.paths).toStrictEqual(['source.txt']);
});

test('an unfetched remote tip selects the same outgoing commits and files as a new ref', async () => {
    await using sandbox = await testdir();
    const { base, reviewed, zero } = await preparePushRepository(sandbox.path);
    runGitStep(sandbox.path, ['remote', 'add', 'origin', 'unused']);
    runGitStep(sandbox.path, ['update-ref', 'refs/remotes/origin/main', base]);
    runGitStep(sandbox.path, ['update-ref', 'refs/remotes/other/main', reviewed]);
    const unfetched = await readPushedRevisions(
        sandbox.path,
        `refs/heads/reviewed ${reviewed} refs/heads/feature ${'f'.repeat(base.length)}\n`,
        'origin',
    );
    const created = await readPushedRevisions(
        sandbox.path,
        `refs/heads/reviewed ${reviewed} refs/heads/feature ${zero}\n`,
        'origin',
    );
    expect(unfetched).toEqual(created);
    expect(unfetched.revisions[0]).toMatchObject({ commits: [reviewed], paths: ['changed.sh'] });
});

test('a new branch pushed while another branch is checked out compares with its own merge base', async () => {
    await using sandbox = await testdir({ 'source.ts': 'export {};\n' });
    const base = commitAll(sandbox.path);
    runGitStep(sandbox.path, ['remote', 'add', 'origin', 'unused']);
    runGitStep(sandbox.path, ['checkout', '-qb', 'side']);
    runGitStep(sandbox.path, ['commit', '--allow-empty', '-qm', 'Side']);
    const side = runGitStep(sandbox.path, ['rev-parse', 'HEAD']);
    runGitStep(sandbox.path, ['checkout', '-q', '-']);
    runGitStep(sandbox.path, ['commit', '--allow-empty', '-qm', 'Ahead']);
    runGitStep(sandbox.path, ['update-ref', 'refs/remotes/origin/main', 'HEAD']);
    const protocol = `refs/heads/side ${side} refs/heads/side ${'0'.repeat(side.length)}\n`;
    const pushed = await readPushedRevisions(sandbox.path, protocol, 'origin');
    expect(pushed.revisions[0]?.base).toBe(base);
});

test('a new orphan branch that is checked out compares with its own root commit', async () => {
    await using sandbox = await testdir({ 'source.ts': 'export {};\n' });
    commitAll(sandbox.path);
    runGitStep(sandbox.path, ['remote', 'add', 'origin', 'unused']);
    runGitStep(sandbox.path, ['update-ref', 'refs/remotes/origin/main', 'HEAD']);
    runGitStep(sandbox.path, ['checkout', '-q', '--orphan', 'pages']);
    runGitStep(sandbox.path, ['commit', '-qm', 'Pages']);
    const orphan = runGitStep(sandbox.path, ['rev-parse', 'HEAD']);
    const protocol = `refs/heads/pages ${orphan} refs/heads/pages ${'0'.repeat(orphan.length)}\n`;
    const pushed = await readPushedRevisions(sandbox.path, protocol, 'origin');
    expect(pushed.revisions[0]?.base).toBe(orphan);
});

test('a push refuses to rewrite the default branch, and needs its remote tip in the clone', async () => {
    await using sandbox = await testdir({ 'source.ts': 'export {};\n' });
    commitAll(sandbox.path);
    const first = runGitStep(sandbox.path, ['rev-parse', 'HEAD']).trim();
    await writeFile(join(sandbox.path, 'source.ts'), 'export const remote = true;\n');
    commitAll(sandbox.path);
    const remote = runGitStep(sandbox.path, ['rev-parse', 'HEAD']).trim();
    runGitStep(sandbox.path, ['reset', '-q', '--hard', first]);
    await writeFile(join(sandbox.path, 'source.ts'), 'export const local = true;\n');
    commitAll(sandbox.path);
    const local = runGitStep(sandbox.path, ['rev-parse', 'HEAD']).trim();
    const rewritten = await captureRejection(
        readPushedRevisions(sandbox.path, `refs/heads/main ${local} refs/heads/main ${remote}\n`),
    );
    expect(rewritten).toMatchObject({ name: 'GspotError', code: 'git' });
    expect(rewritten.message).toContain('refs/heads/main');
    expect(rewritten.message).toContain(remote);
    const unfetched = await captureRejection(
        readPushedRevisions(sandbox.path, `refs/heads/main ${local} refs/heads/main ${'a'.repeat(40)}\n`),
    );
    expect(unfetched).toMatchObject({ name: 'GspotError', code: 'git' });
    expect(unfetched.message).toContain('a'.repeat(40));
    const feature = await readPushedRevisions(sandbox.path, `refs/heads/main ${local} refs/heads/feature ${remote}\n`);
    expect(feature.revisions.map(({ hash }) => hash)).toStrictEqual([local]);
    const forward = await readPushedRevisions(sandbox.path, `refs/heads/main ${local} refs/heads/main ${first}\n`);
    expect(forward.revisions.map(({ hash }) => hash)).toStrictEqual([local]);
    const blob = runGitStep(sandbox.path, ['rev-parse', 'HEAD:source.ts']);
    const corrupt = await captureRejection(
        readPushedRevisions(sandbox.path, `refs/heads/main ${local} refs/heads/main ${blob}\n`),
    );
    expect(corrupt).toMatchObject({ name: 'GspotError', code: 'git' });
    expect(corrupt.message).toContain('merge-base');
    expect(corrupt.message).not.toContain('force-push');
});
