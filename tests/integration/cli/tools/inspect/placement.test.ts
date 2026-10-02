import { join } from 'node:path';
import { test, expect } from 'bun:test';
import type { ToolPin } from '#cli/types/kits.ts';
import { testdir, createFileTree } from 'testdirs';
import { privateToolInstallation } from '#cli/tools/pins.ts';
import { locateTool, inspectTool } from '#cli/tools/inspect.ts';
import { venvExecutable } from '#tests/harness/cli/platforms.ts';
import { EXECUTABLE_FILE } from '#cli/config/platform/platform.ts';
import { commandPin, libraryPin } from '#tests/harness/cli/pins.ts';
import { chmodSync, mkdirSync, existsSync, unlinkSync, symlinkSync } from 'node:fs';

test('managed executable discovery refuses an external link before inspecting and accepts an internal replacement', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'project/.gspot/node_modules/.bin/.keep': '',
        'project/.gspot/node_modules/teller/run.sh': '#!/bin/sh\necho 1.2.3\n',
        'outside/teller': `#!/bin/sh\ntouch '${join(directory.path, 'outside/executed')}'\necho 1.2.3\n`,
    });
    const root = join(directory.path, 'project');
    const binary = join(root, '.gspot/node_modules/.bin/teller');
    chmodSync(join(directory.path, 'outside/teller'), EXECUTABLE_FILE);
    chmodSync(join(root, '.gspot/node_modules/teller/run.sh'), EXECUTABLE_FILE);
    symlinkSync('../../../../outside/teller', binary);
    expect(() => inspectTool({ root, inspections: new Map() }, commandPin('teller', '1.2.3'))).toThrow(
        'Source link leaves the repository',
    );
    expect(existsSync(join(directory.path, 'outside/executed'))).toBe(false);
    unlinkSync(binary);
    symlinkSync('../teller/run.sh', binary);
    expect(inspectTool({ root, inspections: new Map() }, commandPin('teller', '1.2.3')).state).toBe('ok');
});

test('managed library discovery refuses a linked package directory', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'project/.gspot/node_modules/.keep': '',
        'outside/package.json': '{"name":"external-library","version":"1.2.3"}',
    });
    const root = join(directory.path, 'project');
    symlinkSync('../../../outside', join(root, '.gspot/node_modules/external-library'));
    expect(() => inspectTool({ root, inspections: new Map() }, libraryPin('external-library', '1.2.3'))).toThrow(
        'Unsafe lifecycle parent',
    );
});

// Synthetic pins for each installer combination: npm only, npm with mise, PyPI with mise, and none.
const NPM: ToolPin = {
    ...commandPin('linter', '1.0.0', 'linter'),
    installers: { npm: { name: 'linter', version: '1.0.0' } },
};
const MISE_FIRST: ToolPin = {
    ...commandPin('searcher', '2.0.0'),
    installers: { npm: { name: '@scope/searcher', version: '2.0.0' }, mise: { name: 'searcher', version: '2.0.0' } },
};
const PYPI: ToolPin = {
    ...commandPin('formatter', '3.0.0'),
    installers: { pypi: { name: 'formatter', version: '3.0.0' }, mise: { name: 'formatter', version: '3.0.0' } },
};
const NONE: ToolPin = commandPin('compiler', '4.0.0');

test.each([
    ['an npm pin', NPM, undefined, 'npm'],
    ['an npm pin', NPM, 'mise', 'npm'],
    ['an npm or mise pin', MISE_FIRST, 'mise', undefined],
    ['an npm or mise pin', MISE_FIRST, 'npm', 'npm'],
    ['a PyPI pin', PYPI, undefined, 'python'],
    ['a PyPI pin', PYPI, 'mise', 'python'],
    ['a pin with no installer', NONE, undefined, undefined],
] as const)('the private installation of %s under %s is %s', (_label, tool, runner, kind) => {
    const placement = privateToolInstallation(tool, runner);
    expect(placement?.kind).toBe(kind);
    // A private installation pins the version its installer names.
    const installer = placement?.kind === 'python' ? 'pypi' : 'npm';
    expect(placement === undefined ? undefined : tool.installers[installer]?.version).toBe(placement?.version);
});

test('a missing private npm binary cannot fall back to the developer executable', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'node_modules/teller/package.json': '{"name":"teller","version":"5.0.1"}',
        'node_modules/teller/run.sh': '#!/bin/sh\ntouch fallback-ran\necho 5.0.1\n',
    });
    chmodSync(join(sandbox.path, 'node_modules/teller/run.sh'), EXECUTABLE_FILE);
    mkdirSync(join(sandbox.path, 'node_modules/.bin'));
    symlinkSync('../teller/run.sh', join(sandbox.path, 'node_modules/.bin/teller'));
    const tool = commandPin('teller', '5.0.1', 'teller');
    const missing = inspectTool({ root: sandbox.path, inspections: new Map() }, tool);
    expect(missing.state).toBe('missing');
    expect(missing.path).toBeUndefined();
    expect(existsSync(join(sandbox.path, 'fallback-ran'))).toBe(false);
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/teller/package.json': '{"name":"teller","version":"5.0.1"}',
        '.gspot/node_modules/teller/run.sh': '#!/bin/sh\necho 5.0.1\n',
    });
    chmodSync(join(sandbox.path, '.gspot/node_modules/teller/run.sh'), EXECUTABLE_FILE);
    mkdirSync(join(sandbox.path, '.gspot/node_modules/.bin'));
    symlinkSync('../teller/run.sh', join(sandbox.path, '.gspot/node_modules/.bin/teller'));
    expect(inspectTool({ root: sandbox.path, inspections: new Map() }, tool)).toMatchObject({
        state: 'ok',
        found: '5.0.1',
    });
    expect(existsSync(join(sandbox.path, 'fallback-ran'))).toBe(false);
});

test('direct host lookup excludes an unrelated managed compiler', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/.bin/tsc': '#!/bin/sh\nexit 7\n',
        'node_modules/.bin/tsc': '#!/bin/sh\necho 5.9.3\n',
    });
    expect(locateTool(sandbox.path, 'tsc')).toBe(join(sandbox.path, 'node_modules/.bin/tsc'));
});

test('a private Python pin refuses a project executable and uses its own environment', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        [venvExecutable('.venv', 'teller')]:
            `#!${process.execPath}\nawait Bun.write('fallback-ran', '');\nconsole.log('1.2.3');\n`,
    });
    chmodSync(join(sandbox.path, venvExecutable('.venv', 'teller')), EXECUTABLE_FILE);
    const tool = commandPin('teller', '1.2.3');
    tool.installers['pypi'] = { name: 'teller', version: '1.2.3' };
    expect(inspectTool({ root: sandbox.path, inspections: new Map() }, tool).state).toBe('missing');
    await createFileTree(sandbox.path, {
        [venvExecutable('.gspot/.venv', 'teller')]: `#!${process.execPath}\nconsole.log('1.2.3');\n`,
    });
    chmodSync(join(sandbox.path, venvExecutable('.gspot/.venv', 'teller')), EXECUTABLE_FILE);
    expect(inspectTool({ root: sandbox.path, inspections: new Map() }, tool)).toMatchObject({
        state: 'ok',
        found: '1.2.3',
    });
    expect(existsSync(join(sandbox.path, 'fallback-ran'))).toBe(false);
});

test('a snapshot finds a missing native tool missing, through the private tools it links from the working tree', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'work/.gspot/node_modules/.bin/.keep': '',
        'snapshot/.gspot/package.json': '{}',
    });
    const working = join(directory.path, 'work');
    const root = join(directory.path, 'snapshot');
    symlinkSync(join(working, '.gspot/node_modules'), join(root, '.gspot/node_modules'), 'dir');
    const context = { root, inspections: new Map(), installedRoot: working };
    expect(inspectTool(context, commandPin('absent-native-tool', '1.0.0')).state).toBe('missing');
});
