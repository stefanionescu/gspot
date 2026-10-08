import executables from 'which';
import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { inspectTool } from '#cli/tools/public.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { chmod, mkdir, symlink } from 'node:fs/promises';
import type { ToolPin } from '#cli/types/parsers/tool.ts';
import { toolPin } from '#cli/configurations/contracts.ts';
import { EXECUTABLE_FILE } from '#cli/config/platform/modes.ts';
import { configurationManifests } from '#cli/configurations/public.ts';
import { buildBinaryPin, buildLibraryPin } from '#tests/harness/pins.ts';
import { PACKAGE_METADATA_FAILURES } from '#tests/config/cli/tools/versions.ts';

test.each([
    ['console.log("3.8.1"); process.exitCode = 7;', 'error', 'exited 7'],
    ['console.log("unrecognized output");', 'error', 'valid version'],
    ['console.error("3.8.1");', 'ok', undefined],
] as const)('a version process classifies %s as %s', async (script, state, note) => {
    await using sandbox = await testdir();
    using _which = spyOn(executables, 'sync').mockReturnValue(process.execPath);
    const tool = { ...buildBinaryPin('version-teller', '3.8.1'), version_command: ['-e', script] };
    const inspection = inspectTool({ root: sandbox.path, inspections: new Map() }, tool);
    expect(inspection.state).toBe(state);
    // A usable tool reports the version it printed; any other state explains itself in the note.
    expect(note === undefined ? inspection.found : inspection.note).toContain(note ?? '3.8.1');
});

test('an npm package version does not hide a failed executable', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/teller/package.json': '{"name":"teller","version":"5.0.1"}',
        '.gspot/node_modules/teller/run.sh': '#!/bin/sh\necho 5.0.1\nexit 7\n',
    });
    await chmod(join(sandbox.path, '.gspot/node_modules/teller/run.sh'), EXECUTABLE_FILE);
    await mkdir(join(sandbox.path, '.gspot/node_modules/.bin'));
    await symlink('../teller/run.sh', join(sandbox.path, '.gspot/node_modules/.bin/teller'));
    const inspection = inspectTool(
        { root: sandbox.path, inspections: new Map() },
        buildBinaryPin('teller', '5.0.1', 'teller'),
    );
    expect(inspection.state).toBe('error');
    expect(inspection.note).toContain('exited 7');
});

test('a manifest can declare its help command status without accepting other failed inspections', async () => {
    await using sandbox = await testdir();
    using _which = spyOn(executables, 'sync').mockReturnValue(process.execPath);
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
    using _which = spyOn(executables, 'sync').mockReturnValue(process.execPath);
    const pin = { ...buildBinaryPin('version-teller', '3.8.1'), version_command: ['inspection.ts'] };
    const session = await openSession(sandbox.path);
    expect(inspectTool(session, pin).state).toBe('ok');
    expect(inspectTool(session, pin).state).toBe('ok');
    expect(await Bun.file(join(sandbox.path, 'calls.txt')).text()).toBe('1');
    const next = await openSession(sandbox.path);
    expect(inspectTool(next, pin).state).toBe('ok');
    expect(await Bun.file(join(sandbox.path, 'calls.txt')).text()).toBe('2');
});

test.each([
    ['3.2.57', 'outdated'],
    ['5.2.0', 'host'],
] as const)('a host bash that prints %s is %s against the 4.4 floor', async (version, state) => {
    await using sandbox = await testdir();
    using _which = spyOn(executables, 'sync').mockReturnValue(process.execPath);
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
    for (const path of Object.keys(binEntry)) await chmod(join(sandbox.path, path), EXECUTABLE_FILE);
    const inspection = inspectTool(
        { root: sandbox.path, inspections: new Map() },
        buildBinaryPin('teller', '5.0.1', 'teller'),
    );
    expect(inspection.state, inspection.note).toBe('ok');
    expect(inspection.found).toBe('5.0.1');
});

// The preceding numeric release exercises the actual declared floor without copying its value.
function belowFloor(floor: string): string {
    const parts = floor.split('.').map(Number);
    const index = parts.findLastIndex((part) => part > 0);
    parts[index]! -= 1;
    return parts.join('.');
}

test.each(['gitleaks', 'next'])('the shipped %s pin inspects versions below and at its floor', async (name) => {
    await using sandbox = await testdir();
    using _which = spyOn(executables, 'sync').mockReturnValue(process.execPath);
    const pin = toolPin(configurationManifests().values(), name);
    const floor = pin.min_version!;
    const available = pin.system === true ? 'host' : 'ok';
    for (const version of [belowFloor(floor), floor]) {
        const printed = name === 'next' ? `Next.js v${version}` : version;
        const tool = { ...pin, version_command: ['-e', `console.log(${JSON.stringify(printed)});`] };
        expect(inspectTool({ root: sandbox.path, inspections: new Map() }, tool)).toMatchObject({
            state: version === floor ? available : 'outdated',
            found: version,
            floor,
        });
    }
});

test.each([...PACKAGE_METADATA_FAILURES])(
    'a private library rejects non-string $field metadata and accepts corrected bytes',
    async ({ manifest }) => {
        await using sandbox = await testdir();
        const path = join(sandbox.path, '.gspot/node_modules/teller/package.json');
        const original = JSON.stringify(manifest);
        await createFileTree(sandbox.path, { '.gspot/node_modules/teller/package.json': original });
        const context = { root: sandbox.path, inspections: new Map() };
        const tool = buildLibraryPin('teller', '5.0.1');
        expect(() => inspectTool(context, tool)).toThrow(`Cannot read package manifest ${path}:`);
        expect(await Bun.file(path).text()).toBe(original);
        await Bun.write(path, '{"name":"teller","version":"5.0.1"}');
        expect(inspectTool(context, tool)).toMatchObject({ state: 'ok', found: '5.0.1' });
    },
);
