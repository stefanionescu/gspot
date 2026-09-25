import { configurationManifests } from '#cli/configurations/manifests.ts';
import { privateToolInstallation } from '#cli/tools/pins.ts';
import { locateTool, probeTool } from '#cli/tools/probe.ts';
import { commandPin, libraryPin, RUNS } from '#tests/support/cli/pins.ts';
import { expect, test } from 'bun:test';
import { chmodSync, existsSync, mkdirSync, symlinkSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';

test('managed executable discovery refuses an external link before probing and accepts an internal replacement', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'project/.gspot/node_modules/.bin/.keep': '',
        'project/.gspot/node_modules/teller/run.sh': '#!/bin/sh\necho 1.2.3\n',
        'outside/teller': `#!/bin/sh\ntouch '${join(directory.path, 'outside/executed')}'\necho 1.2.3\n`,
    });
    const root = join(directory.path, 'project');
    const binary = join(root, '.gspot/node_modules/.bin/teller');
    chmodSync(join(directory.path, 'outside/teller'), RUNS);
    chmodSync(join(root, '.gspot/node_modules/teller/run.sh'), RUNS);
    symlinkSync('../../../../outside/teller', binary);
    expect(() => probeTool({ root, probes: new Map() }, commandPin('teller', '1.2.3'))).toThrow(
        'Source link leaves the repository',
    );
    expect(existsSync(join(directory.path, 'outside/executed'))).toBe(false);
    unlinkSync(binary);
    symlinkSync('../teller/run.sh', binary);
    expect(probeTool({ root, probes: new Map() }, commandPin('teller', '1.2.3')).state).toBe('ok');
});

test('managed library discovery refuses a linked package directory', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'project/.gspot/node_modules/.keep': '',
        'outside/package.json': '{"name":"external-library","version":"1.2.3"}',
    });
    const root = join(directory.path, 'project');
    symlinkSync('../../../outside', join(root, '.gspot/node_modules/external-library'));
    expect(() => probeTool({ root, probes: new Map() }, libraryPin('external-library', '1.2.3'))).toThrow(
        'Unsafe lifecycle parent',
    );
});

test.each([
    ['javascript', 'eslint', undefined, 'npm'],
    ['javascript', 'eslint', 'mise', 'npm'],
    ['structure', 'ast-grep', 'mise', undefined],
    ['structure', 'ast-grep', 'npm', 'npm'],
    ['python', 'ruff', undefined, 'python'],
    ['python', 'ruff', 'mise', 'python'],
    ['typescript', 'tsc', undefined, undefined],
] as const)('installation placement for %s/%s under %s is %s', (configuration, name, runner, kind) => {
    const tool = configurationManifests()
        .get(configuration)!
        .tools.find((entry) => entry.name === name)!;
    expect(tool).toBeDefined();
    const placement = privateToolInstallation(tool, runner);
    expect(placement?.kind).toBe(kind);
    if (placement !== undefined)
        expect(tool.installers[placement.kind === 'python' ? 'pypi' : 'npm']?.version).toBe(placement.version);
});

test('a missing private npm binary cannot fall back to the developer executable', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'node_modules/teller/package.json': '{"name":"teller","version":"5.0.1"}',
        'node_modules/teller/run.sh': '#!/bin/sh\ntouch fallback-ran\necho 5.0.1\n',
    });
    chmodSync(join(sandbox.path, 'node_modules/teller/run.sh'), RUNS);
    mkdirSync(join(sandbox.path, 'node_modules/.bin'));
    symlinkSync('../teller/run.sh', join(sandbox.path, 'node_modules/.bin/teller'));
    const tool = commandPin('teller', '5.0.1', 'teller');
    const missing = probeTool({ root: sandbox.path, probes: new Map() }, tool);
    expect(missing.state).toBe('missing');
    expect(missing.path).toBeUndefined();
    expect(existsSync(join(sandbox.path, 'fallback-ran'))).toBe(false);
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/teller/package.json': '{"name":"teller","version":"5.0.1"}',
        '.gspot/node_modules/teller/run.sh': '#!/bin/sh\necho 5.0.1\n',
    });
    chmodSync(join(sandbox.path, '.gspot/node_modules/teller/run.sh'), RUNS);
    mkdirSync(join(sandbox.path, '.gspot/node_modules/.bin'));
    symlinkSync('../teller/run.sh', join(sandbox.path, '.gspot/node_modules/.bin/teller'));
    expect(probeTool({ root: sandbox.path, probes: new Map() }, tool)).toMatchObject({ state: 'ok', found: '5.0.1' });
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
        '.venv/bin/teller': '#!/bin/sh\ntouch fallback-ran\necho 1.2.3\n',
    });
    chmodSync(join(sandbox.path, '.venv/bin/teller'), RUNS);
    const tool = commandPin('teller', '1.2.3');
    tool.installers['pypi'] = { name: 'teller', version: '1.2.3' };
    expect(probeTool({ root: sandbox.path, probes: new Map() }, tool).state).toBe('missing');
    await createFileTree(sandbox.path, {
        '.gspot/.venv/bin/teller': '#!/bin/sh\necho 1.2.3\n',
    });
    chmodSync(join(sandbox.path, '.gspot/.venv/bin/teller'), RUNS);
    expect(probeTool({ root: sandbox.path, probes: new Map() }, tool)).toMatchObject({ state: 'ok', found: '1.2.3' });
    expect(existsSync(join(sandbox.path, 'fallback-ran'))).toBe(false);
});
