import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { openSession } from '#cli/engine/session.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { YARN_CLIENTS } from '#tests/config/setup/programs.ts';
import { buildToolLockfiles } from '#tests/setup/cli/tools.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { listStaleLockfiles } from '#cli/tools/installers/projects.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test.each([...YARN_CLIENTS])(
    'Yarn $packageManager.version plans an npm tool lockfile without Yarn settings',
    async ({ packageManager }) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings([]),
            'package.json': JSON.stringify({ private: true, packageManager: `yarn@${packageManager.version}` }),
        });
        const session = await openSession(sandbox.path);
        const generated = buildGeneratedFiles(session);
        expect(generated.files.some(({ path }) => path === '.gspot/.yarnrc.yml')).toBe(false);
        const lockfiles = listStaleLockfiles(session, generated.files);
        expect(
            lockfiles.filter(({ path }) => path !== GSPOT_PATHS.uvLockfile && path !== GSPOT_PATHS.miseLockfile),
        ).toStrictEqual([{ path: '.gspot/package-lock.json', kind: 'absent' }]);
    },
);

test('tool lockfiles report missing and changed projects and omit current projects', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['python']),
        'package.json': '{"private":true,"packageManager":"bun@1.4.2"}',
    });
    const session = await openSession(sandbox.path);
    const generated = buildGeneratedFiles(session).files;
    const paths = [GSPOT_PATHS.miseLockfile, '.gspot/bun.lock', GSPOT_PATHS.uvLockfile];
    expect(listStaleLockfiles(session, generated)).toStrictEqual(paths.map((path) => ({ path, kind: 'absent' })));
    const lockfiles = buildToolLockfiles(session.toolConfigurations);
    await createFileTree(sandbox.path, lockfiles);
    expect(listStaleLockfiles(session, generated)).toStrictEqual([]);
    await createFileTree(sandbox.path, Object.fromEntries(paths.map((path) => [path, 'invalid ='])));
    expect(listStaleLockfiles(session, generated)).toStrictEqual(paths.map((path) => ({ path, kind: 'changed' })));
});
