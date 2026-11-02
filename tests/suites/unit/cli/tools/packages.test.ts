import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { findProgram } from '#cli/system/programs.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { buildProgramPin } from '#tests/setup/cli/tools.ts';
import { listToolStart, findInstalledDependency } from '#cli/tools/packages.ts';

test('an installed dependency version is found when exports hide its package manifest', async () => {
    await using sandbox = await testdir({
        'package.json': '{}',
        'node_modules/hidden/package.json': '{"name":"hidden","version":"1.2.3","exports":{".":"./index.js"}}',
        'node_modules/hidden/index.js': 'export {};',
    });
    expect(findInstalledDependency(sandbox.path, 'package.json', 'hidden')).toStrictEqual({
        path: join(sandbox.path, 'node_modules/hidden/package.json'),
        version: '1.2.3',
    });
    expect(findInstalledDependency(sandbox.path, 'package.json', 'missing')).toBeUndefined();
});

test.each([
    { bin: 'cli.js', script: 'cli.js' },
    { bin: { teller: 'bin/teller.js', other: 'bin/other.js' }, script: 'bin/teller.js' },
])('an npm tool of the tool project starts through Node at $script', async ({ bin, script }) => {
    await using sandbox = await testdir({
        [`${GSPOT_PATHS.nodeModules}/teller/package.json`]: JSON.stringify({ name: 'teller', version: '1.0.0', bin }),
    });
    const tool = buildProgramPin('teller', '1.0.0', 'teller');
    const path = join(sandbox.path, GSPOT_PATHS.nodeModules, '.bin', 'teller');
    expect(listToolStart(sandbox.path, tool, path)).toStrictEqual([
        findProgram('node')!,
        join(sandbox.path, GSPOT_PATHS.nodeModules, 'teller', script),
    ]);
    expect(listToolStart(sandbox.path, tool, join(sandbox.path, 'node_modules/.bin/teller'))).toHaveLength(1);
});
