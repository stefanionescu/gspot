import { join } from 'node:path';
import { expect, spyOn, test } from 'bun:test';
import { probeTool } from '#cli/tools/probe.ts';
import { createFileTree, testdir } from 'testdirs';
import { openSession } from '#cli/execution/session.ts';
import { chmodSync, mkdirSync, symlinkSync } from 'node:fs';
import { commandPin, libraryPin, RUNS } from '#tests/support/cli/pins.ts';

test.each([
    ['console.log("3.8.1"); process.exitCode = 7;', 'error', 'exited 7'],
    ['console.log("unrecognized output");', 'error', 'valid version'],
    ['console.error("3.8.1");', 'ok', undefined],
] as const)('a version process classifies %s as %s', async (script, state, note) => {
    await using sandbox = await testdir();
    const which = spyOn(Bun, 'which').mockReturnValue(process.execPath);
    try {
        const tool = { ...commandPin('version-teller', '3.8.1'), version_command: ['-e', script] };
        const probe = probeTool({ root: sandbox.path, probes: new Map() }, tool);
        expect(probe.state).toBe(state);
        if (note === undefined) {
            expect(probe.found).toBe('3.8.1');
        } else {
            expect(probe.note).toContain(note);
        }
    } finally {
        which.mockRestore();
    }
});

test('an npm package version does not hide a failed executable', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/teller/package.json': '{"name":"teller","version":"5.0.1"}',
        '.gspot/node_modules/teller/run.sh': '#!/bin/sh\necho 5.0.1\nexit 7\n',
    });
    chmodSync(join(sandbox.path, '.gspot/node_modules/teller/run.sh'), RUNS);
    mkdirSync(join(sandbox.path, '.gspot/node_modules/.bin'));
    symlinkSync('../teller/run.sh', join(sandbox.path, '.gspot/node_modules/.bin/teller'));
    const probe = probeTool({ root: sandbox.path, probes: new Map() }, commandPin('teller', '5.0.1', 'teller'));
    expect(probe.state).toBe('error');
    expect(probe.note).toContain('exited 7');
});

test('a version printed before a genuine timeout does not make a tool usable', async () => {
    await using sandbox = await testdir();
    const which = spyOn(Bun, 'which').mockReturnValue(process.execPath);
    try {
        const tool = {
            ...commandPin('version-teller', '3.8.1'),
            version_command: ['-e', 'console.log("3.8.1 No version is set for shim"); setInterval(() => {}, 1000);'],
        };
        const probe = probeTool({ root: sandbox.path, probes: new Map() }, tool);
        expect(probe.state).toBe('error');
        expect(probe.note).toContain('timed out');
    } finally {
        which.mockRestore();
    }
}, 20_000);

test('a manifest can declare its help command status without accepting other failed probes', async () => {
    await using sandbox = await testdir();
    const which = spyOn(Bun, 'which').mockReturnValue(process.execPath);
    try {
        const tool = {
            ...commandPin('version-help', '3.8.1'),
            version_command: ['-e', 'console.log("version-help 3.8.1"); process.exitCode = 2;'],
            version_exit_code: 2,
        };
        const context = { root: sandbox.path, probes: new Map() };
        const probe = probeTool(context, tool);
        expect(probe.state).toBe('ok');
        expect(probe.found).toBe('3.8.1');
        const failed = probeTool(context, { ...tool, version_exit_code: 0 });
        expect(failed.state).toBe('error');
        expect(failed.note).toContain('exited 2');
    } finally {
        which.mockRestore();
    }
});

test('tool observations distinguish pins and refresh private libraries in the next session', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = []\n',
        'api/node_modules/example/package.json': '{"name":"example","version":"1.0.0"}',
    });
    const session = await openSession(sandbox.path);
    const pin = libraryPin('example', '1.0.0');
    expect(probeTool(session, pin).state).toBe('missing');
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/example/package.json': '{"name":"example","version":"1.0.0"}',
    });
    expect(probeTool(session, pin).state).toBe('missing');
    const next = await openSession(sandbox.path);
    expect(probeTool(next, pin).state).toBe('ok');
    expect(probeTool(next, libraryPin('example', '2.0.0')).state).toBe('outdated');
});

test('a command shares version observations and the next session probes again', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = []\n',
        'probe.ts':
            'const file = Bun.file("calls.txt"); const calls = await file.exists() ? Number(await file.text()) : 0; await Bun.write("calls.txt", String(calls + 1)); console.log("3.8.1");',
    });
    const which = spyOn(Bun, 'which').mockReturnValue(process.execPath);
    try {
        const pin = { ...commandPin('version-teller', '3.8.1'), version_command: ['probe.ts'] };
        const session = await openSession(sandbox.path);
        expect(probeTool(session, pin).state).toBe('ok');
        expect(probeTool(session, pin).state).toBe('ok');
        expect(await Bun.file(join(sandbox.path, 'calls.txt')).text()).toBe('1');
        const next = await openSession(sandbox.path);
        expect(probeTool(next, pin).state).toBe('ok');
        expect(await Bun.file(join(sandbox.path, 'calls.txt')).text()).toBe('2');
    } finally {
        which.mockRestore();
    }
});

test.each([
    ['wrapper', 'ok'],
    ['other-package', 'error'],
] as const)('the declared npm version exit applies only to the matching package: %s', async (packageName, state) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/wrapper/package.json': JSON.stringify({ name: packageName, version: '0.7.0' }),
        '.gspot/node_modules/wrapper/run.sh': '#!/bin/sh\necho 0.9.0\nexit 1\n',
    });
    chmodSync(join(sandbox.path, '.gspot/node_modules/wrapper/run.sh'), RUNS);
    mkdirSync(join(sandbox.path, '.gspot/node_modules/.bin'));
    symlinkSync('../wrapper/run.sh', join(sandbox.path, '.gspot/node_modules/.bin/wrapped'));
    const tool = commandPin('wrapped', '0.10.0');
    tool.floor = '0.9.0';
    tool.installers['npm'] = { name: 'wrapper', version: '0.7.0', version_exit_code: 1 };
    const observed = probeTool({ root: sandbox.path, probes: new Map() }, tool);
    expect(observed.state).toBe(state);
    if (state === 'ok') expect(observed.found).toBe('0.9.0');
    else expect(observed.note).toContain('version probe exited 1');
});
