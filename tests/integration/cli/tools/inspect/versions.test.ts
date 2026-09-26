import { join } from 'node:path';
import { expect, spyOn, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { inspectTool } from '#cli/tools/inspect.ts';
import { RUNS } from '#tests/constants/support/cli.ts';
import { openSession } from '#cli/execution/session.ts';
import { chmodSync, mkdirSync, symlinkSync } from 'node:fs';
import { commandPin, libraryPin } from '#tests/support/cli/pins.ts';

test.each([
    ['console.log("3.8.1"); process.exitCode = 7;', 'error', 'exited 7'],
    ['console.log("unrecognized output");', 'error', 'valid version'],
    ['console.error("3.8.1");', 'ok', undefined],
] as const)('a version process classifies %s as %s', async (script, state, note) => {
    await using sandbox = await testdir();
    const which = spyOn(Bun, 'which').mockReturnValue(process.execPath);
    try {
        const tool = { ...commandPin('version-teller', '3.8.1'), version_command: ['-e', script] };
        const inspection = inspectTool({ root: sandbox.path, inspections: new Map() }, tool);
        expect(inspection.state).toBe(state);
        // A usable tool reports the version it printed; any other state explains itself in the note.
        expect(note === undefined ? inspection.found : inspection.note).toContain(note ?? '3.8.1');
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
    const inspection = inspectTool(
        { root: sandbox.path, inspections: new Map() },
        commandPin('teller', '5.0.1', 'teller'),
    );
    expect(inspection.state).toBe('error');
    expect(inspection.note).toContain('exited 7');
});

test('a version printed before a genuine timeout does not make a tool usable', async () => {
    await using sandbox = await testdir();
    const which = spyOn(Bun, 'which').mockReturnValue(process.execPath);
    try {
        const tool = {
            ...commandPin('version-teller', '3.8.1'),
            version_command: ['-e', 'console.log("3.8.1 No version is set for shim"); setInterval(() => {}, 1000);'],
        };
        const inspection = inspectTool({ root: sandbox.path, inspections: new Map() }, tool);
        expect(inspection.state).toBe('error');
        expect(inspection.note).toContain('timed out');
    } finally {
        which.mockRestore();
    }
}, 20_000);

test('a manifest can declare its help command status without accepting other failed inspections', async () => {
    await using sandbox = await testdir();
    const which = spyOn(Bun, 'which').mockReturnValue(process.execPath);
    try {
        const tool = {
            ...commandPin('version-help', '3.8.1'),
            version_command: ['-e', 'console.log("version-help 3.8.1"); process.exitCode = 2;'],
            version_exit_code: 2,
        };
        const context = { root: sandbox.path, inspections: new Map() };
        const inspection = inspectTool(context, tool);
        expect(inspection.state).toBe('ok');
        expect(inspection.found).toBe('3.8.1');
        const failed = inspectTool(context, { ...tool, version_exit_code: 0 });
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
    expect(inspectTool(session, pin).state).toBe('missing');
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/example/package.json': '{"name":"example","version":"1.0.0"}',
    });
    expect(inspectTool(session, pin).state).toBe('missing');
    const next = await openSession(sandbox.path);
    expect(inspectTool(next, pin).state).toBe('ok');
    expect(inspectTool(next, libraryPin('example', '2.0.0')).state).toBe('outdated');
});

test('a command shares version observations and the next session inspections again', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = []\n',
        'inspection.ts':
            'const file = Bun.file("calls.txt"); const calls = await file.exists() ? Number(await file.text()) : 0; await Bun.write("calls.txt", String(calls + 1)); console.log("3.8.1");',
    });
    const which = spyOn(Bun, 'which').mockReturnValue(process.execPath);
    try {
        const pin = { ...commandPin('version-teller', '3.8.1'), version_command: ['inspection.ts'] };
        const session = await openSession(sandbox.path);
        expect(inspectTool(session, pin).state).toBe('ok');
        expect(inspectTool(session, pin).state).toBe('ok');
        expect(await Bun.file(join(sandbox.path, 'calls.txt')).text()).toBe('1');
        const next = await openSession(sandbox.path);
        expect(inspectTool(next, pin).state).toBe('ok');
        expect(await Bun.file(join(sandbox.path, 'calls.txt')).text()).toBe('2');
    } finally {
        which.mockRestore();
    }
});

test.each([
    ['wrapper', 'ok', '0.9.0'],
    ['other-package', 'error', 'version inspection exited 1'],
] as const)(
    'the declared npm version exit applies only to the matching package: %s',
    async (packageName, state, text) => {
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
        const observed = inspectTool({ root: sandbox.path, inspections: new Map() }, tool);
        expect(observed.state).toBe(state);
        expect(state === 'ok' ? observed.found : observed.note).toContain(text);
    },
);
