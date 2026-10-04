import executables from 'which';
import { join } from 'node:path';
import { toolPin } from '#cli/tools/pins.ts';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { inspectTool } from '#cli/tools/inspect.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import type { ToolPin } from '#cli/types/configurations.ts';
import { chmodSync, mkdirSync, symlinkSync } from 'node:fs';
import { EXECUTABLE_FILE } from '#cli/config/platform/root.ts';
import { GITLEAKS_VERSIONS } from '#tests/config/cli/tools/versions.ts';
import { buildBinaryPin, buildLibraryPin } from '#tests/harness/pins.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';

test.each([
    ['console.log("3.8.1"); process.exitCode = 7;', 'error', 'exited 7'],
    ['console.log("unrecognized output");', 'error', 'valid version'],
    ['console.error("3.8.1");', 'ok', undefined],
] as const)('a version process classifies %s as %s', async (script, state, note) => {
    await using sandbox = await testdir();
    const which = spyOn(executables, 'sync').mockReturnValue(process.execPath);
    try {
        const tool = { ...buildBinaryPin('version-teller', '3.8.1'), version_command: ['-e', script] };
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
    chmodSync(join(sandbox.path, '.gspot/node_modules/teller/run.sh'), EXECUTABLE_FILE);
    mkdirSync(join(sandbox.path, '.gspot/node_modules/.bin'));
    symlinkSync('../teller/run.sh', join(sandbox.path, '.gspot/node_modules/.bin/teller'));
    const inspection = inspectTool(
        { root: sandbox.path, inspections: new Map() },
        buildBinaryPin('teller', '5.0.1', 'teller'),
    );
    expect(inspection.state).toBe('error');
    expect(inspection.note).toContain('exited 7');
});

test('a manifest can declare its help command status without accepting other failed inspections', async () => {
    await using sandbox = await testdir();
    const which = spyOn(executables, 'sync').mockReturnValue(process.execPath);
    try {
        const tool = {
            ...buildBinaryPin('version-help', '3.8.1'),
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

test('tool reads distinguish pins and refresh private libraries in the next session', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy([]),
        'api/node_modules/example/package.json': '{"name":"example","version":"1.0.0"}',
    });
    const session = await openSession(sandbox.path);
    const pin = buildLibraryPin('example', '1.0.0');
    expect(inspectTool(session, pin).state).toBe('missing');
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/example/package.json': '{"name":"example","version":"1.0.0"}',
    });
    expect(inspectTool(session, pin).state).toBe('missing');
    const next = await openSession(sandbox.path);
    expect(inspectTool(next, pin).state).toBe('ok');
    expect(inspectTool(next, buildLibraryPin('example', '2.0.0')).state).toBe('outdated');
});

test('a command shares version reads and the next session inspections again', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy([]),
        'inspection.ts':
            'const file = Bun.file("calls.txt"); const calls = await file.exists() ? Number(await file.text()) : 0; await Bun.write("calls.txt", String(calls + 1)); console.log("3.8.1");',
    });
    const which = spyOn(executables, 'sync').mockReturnValue(process.execPath);
    try {
        const pin = { ...buildBinaryPin('version-teller', '3.8.1'), version_command: ['inspection.ts'] };
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
    ['3.2.57', 'outdated'],
    ['5.2.0', 'host'],
] as const)('a host bash that prints %s is %s against the 4.4 floor', async (version, state) => {
    await using sandbox = await testdir();
    const which = spyOn(executables, 'sync').mockReturnValue(process.execPath);
    try {
        const tool: ToolPin = {
            name: 'bash',
            kind: 'binary',
            system: true,
            min_version: '4.4',
            installers: {},
            version_command: ['-e', `console.log("GNU bash, version ${version}(1)-release")`],
            version_pattern: String.raw`version (\d+\.\d+(?:\.\d+)?)`,
        };
        const inspection = inspectTool({ root: sandbox.path, inspections: new Map() }, tool);
        expect(inspection).toMatchObject({ state, found: version, floor: '4.4' });
    } finally {
        which.mockRestore();
    }
});

test('an npm tool behind a shim file takes the version of its package', async () => {
    await using sandbox = await testdir();
    // npm and Bun write a shim file on Windows, where a symlink into the package serves on other systems.
    const binEntry =
        process.platform === 'win32'
            ? { '.gspot/node_modules/.bin/teller.cmd': '@echo unknown\r\n' }
            : { '.gspot/node_modules/.bin/teller': '#!/bin/sh\necho unknown\n' };
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/teller/package.json': '{"name":"teller","version":"5.0.1"}',
        ...binEntry,
    });
    for (const path of Object.keys(binEntry)) chmodSync(join(sandbox.path, path), EXECUTABLE_FILE);
    const inspection = inspectTool(
        { root: sandbox.path, inspections: new Map() },
        buildBinaryPin('teller', '5.0.1', 'teller'),
    );
    expect(inspection.state, inspection.note).toBe('ok');
    expect(inspection.found).toBe('5.0.1');
});

test.each(GITLEAKS_VERSIONS)(
    'the shipped Gitleaks pin classifies version %s as %s at its allowlist floor',
    async (version, state) => {
        await using sandbox = await testdir();
        const which = spyOn(executables, 'sync').mockReturnValue(process.execPath);
        try {
            const tool = {
                ...toolPin(configurationManifests().values(), 'gitleaks'),
                version_command: ['-e', `console.log(${JSON.stringify(version)});`],
            };
            expect(inspectTool({ root: sandbox.path, inspections: new Map() }, tool)).toMatchObject({
                state,
                found: version,
                floor: '8.25.0',
            });
        } finally {
            which.mockRestore();
        }
    },
);
