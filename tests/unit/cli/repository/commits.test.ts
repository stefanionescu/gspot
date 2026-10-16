import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test, expect, describe } from 'bun:test';
import { isWindows } from '#tests/setup/system.ts';
import { testdir, createFileTree } from 'testdirs';
import { readFile, writeFile } from 'node:fs/promises';
import { PUSH_CONTENT } from '#tests/data/test-setup.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { selectPush } from '#cli/repository/revisions/push.ts';
import { readBlobs, listHeadEntries } from '#cli/repository/revisions/tree-entries.ts';
import { readGitOutput, preparePushRepository, prepareNestedRepository } from '#tests/setup/git.ts';

describe('objects', () => {
    // Windows file names cannot hold a newline or a quote.
    test.skipIf(isWindows)('committed blobs keep unusual file names and bytes', async () => {
        await using sandbox = await testdir();
        readGitOutput(sandbox.path, ['init']);
        const path = 'a\n"é.sql';
        await createFileTree(sandbox.path, { [path]: 'select 1;\n' });
        readGitOutput(sandbox.path, ['add', '.']);
        readGitOutput(sandbox.path, ['commit', '-m', 'Fixture']);
        const entries = await listHeadEntries(sandbox.path);
        expect(entries.map((entry) => entry.path)).toStrictEqual([path]);
        const blobs = await readBlobs(
            sandbox.path,
            entries.map((entry) => entry.hash),
        );
        expect(blobs[0]?.toString()).toBe('select 1;\n');
    });

    test('unborn history is empty, and a broken HEAD refuses committed history', async () => {
        await using sandbox = await testdir();
        readGitOutput(sandbox.path, ['init']);
        expect(await listHeadEntries(sandbox.path)).toStrictEqual([]);
        await writeFile(join(sandbox.path, '.git', 'HEAD'), 'broken');
        expect(await captureRejection(listHeadEntries(sandbox.path))).toContain(
            'Cannot read committed Git history. Restore HEAD and check again.',
        );
    });
});

test.each(['origin', undefined, 'file:///unused', '/unused'] as const)(
    'the hook remote %s selects its tracking range',
    async (remote) => {
        await using sandbox = await testdir();
        const { base, reviewed, broken, zero } = await preparePushRepository(sandbox.path);
        readGitOutput(sandbox.path, ['remote', 'add', 'origin', 'unused']);
        for (const [name, commit] of [
            ['origin', base],
            ['other', reviewed],
        ] as const)
            readGitOutput(sandbox.path, ['update-ref', `refs/remotes/${name}/main`, commit]);
        const protocol = `refs/heads/reviewed ${reviewed} refs/heads/new ${zero}\n`;
        const selected = await selectPush(sandbox.path, protocol, remote);
        expect(selected.revisions[0]?.commits).toStrictEqual(remote === 'origin' ? [reviewed] : []);
        expect(selected.revisions[0]?.paths).toStrictEqual(remote === 'origin' ? ['changed.sh'] : []);
        expect(readGitOutput(sandbox.path, ['rev-parse', 'HEAD'])).toBe(broken);
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
    const branch = readGitOutput(source, ['branch', '--show-current']);
    readGitOutput(sandbox.path, [
        'clone',
        '--quiet',
        '--depth=1',
        '--branch',
        'reviewed',
        pathToFileURL(source).href,
        'checkout',
    ]);
    const checkout = join(sandbox.path, 'checkout');
    readGitOutput(checkout, ['remote', 'add', 'unseen', pathToFileURL(source).href]);
    const protocol = `refs/heads/reviewed ${reviewed} refs/heads/new ${'0'.repeat(reviewed.length)}\n`;
    const unobserved = await selectPush(checkout, protocol, 'unseen');
    expect(unobserved.revisions[0]).toMatchObject({ commits: [reviewed], historyComplete: false });
    expect(unobserved.revisions[0]?.paths).toStrictEqual(['changed.sh', 'gspot.toml', 'legacy.sh']);
    const advertised = await selectPush(checkout, protocol);
    expect(advertised.revisions[0]).toMatchObject({ commits: [], paths: [], historyComplete: true });
    readGitOutput(checkout, ['fetch', '--unshallow']);
    const complete = await selectPush(checkout, protocol, 'unseen');
    expect(complete.revisions[0]).toMatchObject({ commits: [reviewed, base], historyComplete: true });
    expect(readGitOutput(source, ['branch', '--show-current'])).toBe(branch);
});

test('a gspot.toml below the Git root keeps paths relative to its folder for updated and new branches', async () => {
    await using sandbox = await testdir();
    const { project, base, commitId } = await prepareNestedRepository(sandbox.path);
    const protocol = `refs/heads/main ${commitId} refs/heads/main ${base}\n`;
    const updated = await selectPush(project, protocol);
    expect(updated.revisions[0]?.paths).toStrictEqual(['source.txt']);
    readGitOutput(sandbox.path, ['config', 'remote.example.fetch', '+refs/heads/*:refs/remotes/example/*']);
    readGitOutput(sandbox.path, ['update-ref', 'refs/remotes/example/main', base]);
    const createdRef = `refs/heads/new ${commitId} refs/heads/new ${'0'.repeat(commitId.length)}\n`;
    const created = await selectPush(project, createdRef, 'example');
    expect(created.revisions[0]?.paths).toStrictEqual(['source.txt']);
    expect(await Bun.file(join(project, 'source.txt')).text()).toBe('working');
});
