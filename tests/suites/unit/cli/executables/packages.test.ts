import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { findInstalledDependency } from '#cli/executables/packages.ts';

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
