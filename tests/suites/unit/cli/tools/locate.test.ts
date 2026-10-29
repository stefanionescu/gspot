import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { listExecutablePaths } from '#cli/tools/locate.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { fakeExecutableLookup } from '#tests/setup/system/fakes.ts';

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
