import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { testdir } from 'testdirs';
import { realpathSync } from 'node:fs';
import { test, spyOn, expect } from 'bun:test';
import { rm, writeFile } from 'node:fs/promises';
import type { SpawnOptions } from '#cli/types/system.ts';
import * as processes from '#cli/system/processes/run.ts';
import { readMiseBinPaths } from '#cli/tools/programs/mise.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { fakeCommands, fakeExecutableLookup } from '#tests/setup/system/fakes.ts';
import { MISE_PROJECT_MESSAGE, MISE_STALE_PROJECT_MESSAGE } from '#cli/config/tools/mise.ts';

test('mise reads the tool project for one call only while it is the generated one with no other mise file', async () => {
    const project = '[tools]\nshfmt = "3.12.0"\n';
    await using sandbox = await testdir({ '.gspot/mise.toml': project });
    const root = realpathSync(sandbox.path);
    const calls: SpawnOptions[] = [];
    using _lookup = fakeExecutableLookup((name) => (name === 'mise' ? join(root, 'bin/mise') : undefined));
    using _spawn = spyOn(processes, 'runProcess').mockImplementation((_command, options) => {
        calls.push(options);
        return Promise.resolve(buildProcessResult({ stdout: '/mise/installs/shfmt/3.12.0\n' }));
    });
    const query = { timeoutSeconds: 1, project };
    expect(await readMiseBinPaths(sandbox.path, ['shfmt'], query)).toStrictEqual({
        folders: ['/mise/installs/shfmt/3.12.0'],
    });
    expect(calls.map((options) => options.env)).toMatchObject([
        { MISE_TRUSTED_CONFIG_PATHS: join(root, '.gspot/mise.toml'), MISE_CEILING_PATHS: root },
    ]);
    await writeFile(join(sandbox.path, '.gspot/mise.local.toml'), '[env]\n');
    expect(await readMiseBinPaths(sandbox.path, ['shfmt'], query)).toStrictEqual({
        folders: [],
        failure: MISE_PROJECT_MESSAGE,
    });
    await rm(join(sandbox.path, '.gspot/mise.local.toml'));
    await writeFile(join(sandbox.path, '.gspot/mise.toml'), `${project}[env]\n`);
    expect(await readMiseBinPaths(sandbox.path, ['shfmt'], query)).toStrictEqual({
        folders: [],
        failure: MISE_STALE_PROJECT_MESSAGE,
    });
    expect(calls).toHaveLength(1);
});

test('a failed mise call gives its exit code and its error', async () => {
    const project = '[tools]\nshfmt = "3.12.0"\n';
    await using sandbox = await testdir({ '.gspot/mise.toml': project });
    using _lookup = fakeExecutableLookup((name) => (name === 'mise' ? join(tmpdir(), 'mise') : null));
    using _spawn = fakeCommands('mise', () =>
        Promise.resolve(buildProcessResult({ code: 3, stderr: 'mise ERROR the disk is full\n' })),
    );
    const paths = await readMiseBinPaths(sandbox.path, ['shfmt'], { timeoutSeconds: 1, project });
    expect(paths).toStrictEqual({
        folders: [],
        failure: expect.stringContaining('mise ERROR the disk is full') as string,
    });
    expect(paths.failure).toMatch(/\b3\b/u);
});
