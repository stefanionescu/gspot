import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { openSession, readSelectedCommits } from '#cli/engine/session.ts';
import { listAlwaysSelected } from '#cli/manifests/select.ts';
import { compareText } from '#cli/system/text/order.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';

test('all selects the always-selected configurations from an empty list', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { level: 'all' }),
        'source.js': 'export const port = 8080;\n',
        'guide.md': '# Guide\n',
        'app/package.json': '{"name":"app","private":true}',
        'app/source.js': 'export const port = 3000;\n',
    });
    commitAll(sandbox.path);
    const session = await openSession(sandbox.path);
    const selected = new Set(
        session.scopes.flatMap((scope) => scope.configurations.map((configuration) => configuration.name)),
    );
    expect([...selected].toSorted(compareText)).toStrictEqual(listAlwaysSelected().toSorted(compareText));
});

test('push comparison tells a missing upstream from an upstream whose commit is gone', async () => {
    await using sandbox = await testdir({ 'source.ts': 'export {};\n' });

    commitAll(sandbox.path);
    expect(await readSelectedCommits({ toolsRoot: sandbox.path })).toStrictEqual([]);
    await writeFile(join(sandbox.path, 'source.ts'), 'export const changed = true;\n');
    runGitStep(sandbox.path, ['add', '.']);
    runGitStep(sandbox.path, ['commit', '-qm', 'Second']);
    runGitStep(sandbox.path, ['branch', 'upstream']);
    runGitStep(sandbox.path, ['branch', '--set-upstream-to=upstream']);
    expect(await readSelectedCommits({ toolsRoot: sandbox.path })).toStrictEqual([]);
    runGitStep(sandbox.path, ['update-ref', '-d', 'refs/heads/upstream']);
    const error = await captureRejection(readSelectedCommits({ toolsRoot: sandbox.path }));
    expect(error).toMatchObject({ name: 'GspotError', code: 'arguments' });
    expect(error.message).toContain('refs/heads/upstream');
});

test('push comparison of an unborn HEAD has no commits', async () => {
    await using sandbox = await createGitSandbox({ 'source.ts': 'export {};\n' });

    expect(await readSelectedCommits({ toolsRoot: sandbox.path })).toStrictEqual([]);
});

test('a branch without an upstream pushes the commits that the remote default branch lacks', async () => {
    await using sandbox = await testdir({ 'source.ts': 'export {};\n' });

    commitAll(sandbox.path);
    runGitStep(sandbox.path, ['update-ref', 'refs/remotes/origin/main', 'HEAD']);
    runGitStep(sandbox.path, ['symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main']);
    runGitStep(sandbox.path, ['checkout', '-qb', 'topic']);
    runGitStep(sandbox.path, ['commit', '--allow-empty', '-qm', 'Unpublished']);
    expect(await readSelectedCommits({ toolsRoot: sandbox.path })).toStrictEqual([
        runGitStep(sandbox.path, ['rev-parse', 'HEAD']),
    ]);
});
