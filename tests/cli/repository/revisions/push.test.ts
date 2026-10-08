import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { PUSH_CONTENT } from '#tests/config/samples/git.ts';
import { selectPush } from '#cli/repository/revisions/push.ts';
import { gitOutput, preparePushRepository } from '#tests/harness/git.ts';

test.each(['origin', undefined, 'file:///unused', '/unused'] as const)(
    'the hook remote %s selects its native tracking range',
    async (remote) => {
        await using sandbox = await testdir();
        const { base, reviewed, broken, zero } = await preparePushRepository(sandbox.path);
        gitOutput(sandbox.path, ['remote', 'add', 'origin', 'unused']);
        gitOutput(sandbox.path, ['update-ref', 'refs/remotes/origin/main', base]);
        gitOutput(sandbox.path, ['update-ref', 'refs/remotes/other/main', reviewed]);
        const protocol = `refs/heads/reviewed ${reviewed} refs/heads/new ${zero}\n`;
        const selected = await selectPush(sandbox.path, protocol, remote);
        expect(selected.revisions[0]?.commits).toStrictEqual(remote === 'origin' ? [reviewed] : []);
        expect(selected.revisions[0]?.paths).toStrictEqual(remote === 'origin' ? ['changed.sh'] : []);
        expect(gitOutput(sandbox.path, ['rev-parse', 'HEAD'])).toBe(broken);
        expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(PUSH_CONTENT.policy);
        expect(await readFile(join(sandbox.path, 'changed.sh'), 'utf8')).toBe(PUSH_CONTENT.working);
    },
);

test('native shallow ranges distinguish unobserved history from already advertised commits', async () => {
    await using sandbox = await testdir();
    const source = join(sandbox.path, 'source');
    const { base, reviewed } = await preparePushRepository(source);
    const branch = gitOutput(source, ['branch', '--show-current']);
    gitOutput(sandbox.path, [
        'clone',
        '--quiet',
        '--depth=1',
        '--branch',
        'reviewed',
        pathToFileURL(source).href,
        'checkout',
    ]);
    const checkout = join(sandbox.path, 'checkout');
    gitOutput(checkout, ['remote', 'add', 'unseen', pathToFileURL(source).href]);
    const protocol = `refs/heads/reviewed ${reviewed} refs/heads/new ${'0'.repeat(reviewed.length)}\n`;
    const unobserved = await selectPush(checkout, protocol, 'unseen');
    expect(unobserved.revisions[0]).toMatchObject({ commits: [reviewed], historyComplete: false });
    expect(unobserved.revisions[0]?.paths).toStrictEqual(['changed.sh', 'gspot.toml', 'legacy.sh']);
    const advertised = await selectPush(checkout, protocol);
    expect(advertised.revisions[0]).toMatchObject({ commits: [], paths: [], historyComplete: true });
    gitOutput(checkout, ['fetch', '--unshallow']);
    const complete = await selectPush(checkout, protocol, 'unseen');
    expect(complete.revisions[0]).toMatchObject({ commits: [reviewed, base], historyComplete: true });
    expect(gitOutput(source, ['branch', '--show-current'])).toBe(branch);
});
