import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { inspectTool } from '#cli/tools/public.ts';
import { testdir, createFileTree } from 'testdirs';
import { toolPin } from '#cli/configurations/contracts.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { EXECUTABLE_FILE } from '#cli/config/platform/modes.ts';
import { chmod, mkdir, unlink, symlink } from 'node:fs/promises';
import { environmentExecutable } from '#cli/platform/contracts.ts';
import { configurationManifests } from '#cli/configurations/public.ts';
import { buildBinaryPin, buildLibraryPin, inspectionContext } from '#tests/harness/pins.ts';

test('managed executable discovery refuses an external link before inspecting and accepts an internal replacement', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'project/.gspot/node_modules/.bin/.keep': '',
        'project/.gspot/node_modules/teller/run.sh': '#!/bin/sh\necho 1.2.3\n',
        'outside/teller': `#!/bin/sh\ntouch '${join(directory.path, 'outside/executed')}'\necho 1.2.3\n`,
    });
    const root = join(directory.path, 'project');
    const binary = join(root, '.gspot/node_modules/.bin/teller');
    await chmod(join(directory.path, 'outside/teller'), EXECUTABLE_FILE);
    await chmod(join(root, '.gspot/node_modules/teller/run.sh'), EXECUTABLE_FILE);
    await symlink('../../../../outside/teller', binary);
    expect(() => inspectTool(inspectionContext(root), buildBinaryPin('teller', '1.2.3'))).toThrow(
        'Source link leaves the repository',
    );
    expect(await pathExists(join(directory.path, 'outside/executed'))).toBe(false);
    await unlink(binary);
    await symlink('../teller/run.sh', binary);
    expect(inspectTool(inspectionContext(root), buildBinaryPin('teller', '1.2.3')).state).toBe('ok');
});

test('managed library discovery refuses a package directory linked outside the repository', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'project/.gspot/node_modules/.keep': '',
        'outside/package.json': '{"name":"external-library","version":"1.2.3"}',
    });
    const root = join(directory.path, 'project');
    await symlink('../../../outside', join(root, '.gspot/node_modules/external-library'));
    expect(() => inspectTool(inspectionContext(root), buildLibraryPin('external-library', '1.2.3'))).toThrow(
        'Source link leaves the repository',
    );
});

test('a missing private npm binary cannot fall back to the developer executable', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'node_modules/teller/package.json': '{"name":"teller","version":"5.0.1"}',
        'node_modules/teller/run.sh': '#!/bin/sh\ntouch fallback-ran\necho 5.0.1\n',
    });
    await chmod(join(sandbox.path, 'node_modules/teller/run.sh'), EXECUTABLE_FILE);
    await mkdir(join(sandbox.path, 'node_modules/.bin'));
    await symlink('../teller/run.sh', join(sandbox.path, 'node_modules/.bin/teller'));
    const tool = buildBinaryPin('teller', '5.0.1', 'teller');
    const missing = inspectTool(inspectionContext(sandbox.path), tool);
    expect(missing.state).toBe('missing');
    expect(missing.path).toBeUndefined();
    expect(await pathExists(join(sandbox.path, 'fallback-ran'))).toBe(false);
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/teller/package.json': '{"name":"teller","version":"5.0.1"}',
        '.gspot/node_modules/teller/run.sh': '#!/bin/sh\necho 5.0.1\n',
    });
    await chmod(join(sandbox.path, '.gspot/node_modules/teller/run.sh'), EXECUTABLE_FILE);
    await mkdir(join(sandbox.path, '.gspot/node_modules/.bin'));
    await symlink('../teller/run.sh', join(sandbox.path, '.gspot/node_modules/.bin/teller'));
    expect(inspectTool(inspectionContext(sandbox.path), tool)).toMatchObject({
        state: 'ok',
        found: '5.0.1',
    });
    expect(await pathExists(join(sandbox.path, 'fallback-ran'))).toBe(false);
});

test('direct host lookup excludes an unrelated managed compiler', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/.bin/tsc': '#!/bin/sh\nexit 7\n',
        'node_modules/.bin/tsc': '#!/bin/sh\necho 5.9.3\n',
    });
    await chmod(join(sandbox.path, 'node_modules/.bin/tsc'), EXECUTABLE_FILE);
    const inspection = inspectTool(inspectionContext(sandbox.path), toolPin(configurationManifests().values(), 'tsc'));
    expect(inspection).toMatchObject({
        state: 'host',
        path: join(sandbox.path, 'node_modules/.bin/tsc'),
        found: '5.9.3',
    });
});

test('a private Python pin refuses a project executable and uses its own environment', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        [environmentExecutable('.venv', 'teller')]:
            `#!${process.execPath}\nawait Bun.write('fallback-ran', '');\nconsole.log('1.2.3');\n`,
    });
    await chmod(join(sandbox.path, environmentExecutable('.venv', 'teller')), EXECUTABLE_FILE);
    const tool = buildBinaryPin('teller', '1.2.3');
    tool.installers['pypi'] = { name: 'teller', version: '1.2.3' };
    expect(inspectTool(inspectionContext(sandbox.path), tool).state).toBe('missing');
    await createFileTree(sandbox.path, {
        [environmentExecutable('.gspot/.venv', 'teller')]: `#!${process.execPath}\nconsole.log('1.2.3');\n`,
    });
    await chmod(join(sandbox.path, environmentExecutable('.gspot/.venv', 'teller')), EXECUTABLE_FILE);
    expect(inspectTool(inspectionContext(sandbox.path), tool)).toMatchObject({
        state: 'ok',
        found: '1.2.3',
    });
    expect(await pathExists(join(sandbox.path, 'fallback-ran'))).toBe(false);
});

test('a snapshot finds a missing native tool missing, through the private tools it links from the working tree', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'work/.gspot/node_modules/.bin/.keep': '',
        'snapshot/.gspot/package.json': '{}',
    });
    const working = join(directory.path, 'work');
    const root = join(directory.path, 'snapshot');
    await symlink(join(working, '.gspot/node_modules'), join(root, '.gspot/node_modules'), 'dir');
    const context = { ...inspectionContext(root), installedRoot: working };
    expect(inspectTool(context, buildBinaryPin('absent-native-tool', '1.0.0')).state).toBe('missing');
});

test('library inspection accepts an internal package-directory link and refuses an external target', async () => {
    await using sandbox = await testdir();
    await using outside = await testdir();
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/.store/globals/package.json': '{"name":"globals","version":"17.12.0"}',
    });
    await createFileTree(outside.path, { 'package.json': '{"name":"globals","version":"17.12.0"}' });
    const link = join(sandbox.path, '.gspot/node_modules/globals');
    await symlink('.store/globals', link);
    const context = inspectionContext(sandbox.path);
    const tool = buildLibraryPin('globals', '17.12.0');
    expect(inspectTool(context, tool)).toMatchObject({ state: 'ok', found: '17.12.0' });
    await unlink(link);
    await symlink(outside.path, link);
    context.inspections.clear();
    expect(() => inspectTool(context, tool)).toThrow('Source link leaves the repository');
    expect(await Bun.file(join(outside.path, 'package.json')).text()).toBe('{"name":"globals","version":"17.12.0"}');
});
