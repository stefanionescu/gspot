import { testdir } from 'testdirs';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import * as processes from '#cli/system/processes.ts';
import { generate } from '#cli/generation/generate.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { listStaleLockfiles } from '#cli/install/tool-projects.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';

test('a Yarn 1 repository plans an npm tool lockfile without Yarn settings', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([]),
        'package.json': '{"private":true,"packageManager":"yarn@1.22.22"}',
    });
    const run = processes.spawnProcessBlocking;
    using _npmVersion = spyOn(processes, 'spawnProcessBlocking').mockImplementation((command, options) =>
        command[0] === 'npm' && command[1] === '--version'
            ? buildProcessResult({ stdout: '11.19.0\n' })
            : run(command, options),
    );
    const session = await openSession(sandbox.path);
    const generated = generate(session);
    expect(generated.files.some(({ path }) => path === GSPOT_PATHS.yarnSettings)).toBe(false);
    const lockfiles = await listStaleLockfiles(session, generated.files);
    expect(lockfiles.filter(({ path }) => path !== GSPOT_PATHS.uvLockfile)).toStrictEqual([
        { path: '.gspot/package-lock.json', kind: 'missing' },
    ]);
    expect(session.packageManager).toStrictEqual({ name: 'yarn', version: '1.22.22' });
});
