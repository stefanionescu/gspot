import { join } from 'node:path';
import { testdir } from 'testdirs';
import { realpathSync } from 'node:fs';
import { test, spyOn, expect } from 'bun:test';
import { rm, writeFile } from 'node:fs/promises';
import * as processes from '#cli/system/processes.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import type { SpawnOptions } from '#cli/types/system/system.ts';
import { fakeExecutableLookup } from '#tests/setup/system/fakes.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { readMiseBinPaths, listExecutablePaths } from '#cli/executables/locate.ts';

test('project pytest is found in its virtual environment before the global executable', async () => {
    const executable = isWindows ? '.venv/Scripts/pytest.exe' : '.venv/bin/pytest';
    await using sandbox = await testdir({
        [`project/${executable}`]: 'project pytest',
        'system/pytest': 'global pytest',
    });
    const globalPath = join(sandbox.path, 'system/pytest');
    using _lookup = fakeExecutableLookup((name) => (name === 'pytest' ? globalPath : null));
    expect(
        listExecutablePaths(sandbox.path, 'pytest', {
            folders: [join(sandbox.path, 'project')],
            timeoutSeconds: 1,
        }),
    ).toStrictEqual([join(sandbox.path, 'project', executable), globalPath]);
});

test('mise reads the tool project for one call only while it is the generated one with no other mise file', async () => {
    const project = '[tools]\nshfmt = "3.12.0"\n';
    await using sandbox = await testdir({ '.gspot/mise.toml': project });
    const root = realpathSync(sandbox.path);
    const calls: SpawnOptions[] = [];
    using _lookup = fakeExecutableLookup((name) => (name === 'mise' ? join(root, 'bin/mise') : undefined));
    using _spawn = spyOn(processes, 'spawnProcessBlocking').mockImplementation((_command, options) => {
        calls.push(options);
        return buildProcessResult({ stdout: '/mise/installs/shfmt/3.12.0\n' });
    });
    const query = { timeoutSeconds: 1, project };
    expect(readMiseBinPaths(sandbox.path, ['shfmt'], query)).toStrictEqual(['/mise/installs/shfmt/3.12.0']);
    expect(calls.map((options) => options.env)).toMatchObject([
        { MISE_TRUSTED_CONFIG_PATHS: join(root, '.gspot/mise.toml'), MISE_CEILING_PATHS: root },
    ]);
    await writeFile(join(sandbox.path, '.gspot/mise.local.toml'), '[env]\n');
    expect(readMiseBinPaths(sandbox.path, ['shfmt'], query)).toStrictEqual([]);
    await rm(join(sandbox.path, '.gspot/mise.local.toml'));
    await writeFile(join(sandbox.path, '.gspot/mise.toml'), `${project}[env]\n`);
    expect(readMiseBinPaths(sandbox.path, ['shfmt'], query)).toStrictEqual([]);
    expect(calls).toHaveLength(1);
});
