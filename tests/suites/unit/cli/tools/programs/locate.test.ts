import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { listExecutablePaths } from '#cli/tools/programs/locate.ts';
import { fakeCommands, fakeExecutableLookup } from '#tests/setup/system/fakes.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';

test('project pytest is found in its virtual environment, and the global executable only without it', async () => {
    const executable = isWindows ? '.venv/Scripts/pytest.exe' : '.venv/bin/pytest';
    await using sandbox = await testdir({
        [`project/${executable}`]: 'project pytest',
        'system/pytest': 'global pytest',
    });
    const globalPath = join(sandbox.path, 'system/pytest');
    using _lookup = fakeExecutableLookup((name) => (name === 'pytest' ? globalPath : null));
    const search = { folders: [join(sandbox.path, 'project')], timeoutSeconds: 1 };
    const project = await listExecutablePaths(sandbox.path, 'pytest', search);
    expect(project.paths).toStrictEqual([join(sandbox.path, 'project', executable)]);
    await rm(join(sandbox.path, 'project', executable));
    const global = await listExecutablePaths(sandbox.path, 'pytest', search);
    expect(global.paths).toStrictEqual([globalPath]);
});

test('a program in a folder that mise lists is found without asking mise for its shim', async () => {
    await using sandbox = await testdir({ 'installs/vale/.keep': '' });
    const installs = join(sandbox.path, 'installs/vale');
    await writeFile(join(installs, isWindows ? 'vale.exe' : 'vale'), '');
    using _lookup = fakeExecutableLookup((name) => join(sandbox.path, 'mise/shims', name));
    using spawn = fakeCommands('mise', () => Promise.resolve(buildProcessResult({ code: 1 })));
    const { paths } = await listExecutablePaths(sandbox.path, 'vale', {
        folders: [join(sandbox.path, '.gspot')],
        miseBinPaths: [installs],
        timeoutSeconds: 1,
    });
    expect(paths).toStrictEqual([join(installs, isWindows ? 'vale.exe' : 'vale')]);
    expect(spawn).not.toHaveBeenCalled();
});
