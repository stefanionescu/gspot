import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { chmod, readFile } from 'node:fs/promises';
import { inspectTool } from '#cli/tools/inspect.ts';
import { useExecutable } from '#tests/setup/processes.ts';
import { EXECUTABLE_FILE } from '#cli/config/system/modes.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { fakeTool, fakeNpmPackage } from '#tests/setup/fakes.ts';
import { getToolDeclaration } from '#cli/configurations/tools.ts';
import { type ToolDeclaration } from '#cli/types/configurations.ts';
import { VERSION_OUTPUTS } from '#tests/data/install/installation.ts';
import { buildProgramPin, buildInspectionContext } from '#tests/setup/builders.ts';

test('an npm tool is the version its package holds, whatever it prints', async () => {
    await using sandbox = await testdir();
    await fakeNpmPackage(sandbox.path, '.gspot/node_modules', 'teller', '5.0.1', "console.log('4.4.2');\n");
    const inspection = inspectTool(buildInspectionContext(sandbox.path), buildProgramPin('teller', '5.0.1', 'teller'));
    expect(inspection.found).toBe('5.0.1');
    expect(inspection.state).toBe('ok');
});

test('a shim that no configuration gives a version is missing, not broken', async () => {
    await using sandbox = await testdir({
        'node_modules/.bin/shimmed': "#!/bin/sh\necho 'mise ERROR No version is set for shim: shimmed' >&2\nexit 1\n",
    });

    await chmod(join(sandbox.path, 'node_modules/.bin/shimmed'), EXECUTABLE_FILE);
    const inspection = inspectTool(buildInspectionContext(sandbox.path), buildProgramPin('shimmed', '3.8.1'));
    expect(inspection.state).toBe('missing');
    expect(inspection.want).toBe('3.8.1');
});

test.each(VERSION_OUTPUTS)('version output %s gives the state %s', async (script, state, found, note) => {
    await using sandbox = await testdir();
    using _which = useExecutable(process.execPath);
    const tool = { ...buildProgramPin('version-teller', '3.8.1'), version_command: ['-e', script] };
    const inspection = inspectTool(buildInspectionContext(sandbox.path), tool);
    expect(inspection.state).toBe(state);
    expect(inspection.found).toBe(found);
    expect(inspection.note).toBe(note);
});

test('an npm package version does not hide a failed program', async () => {
    await using sandbox = await testdir();
    await fakeNpmPackage(
        sandbox.path,
        '.gspot/node_modules',
        'teller',
        '5.0.1',
        "console.log('5.0.1'); process.exitCode = 7;\n",
    );
    const inspection = inspectTool(buildInspectionContext(sandbox.path), buildProgramPin('teller', '5.0.1', 'teller'));
    expect(inspection.state).toBe('error');
    expect(inspection.note).toContain('exited 7');
});

test('a manifest can declare the exit code of its version command without accepting other failures', async () => {
    await using sandbox = await testdir();
    using _which = useExecutable(process.execPath);
    const tool = {
        ...buildProgramPin('version-help', '3.8.1'),
        version_command: ['-e', 'console.log("version-help 3.8.1"); process.exitCode = 2;'],
        version_exit_code: 2,
    };
    const context = buildInspectionContext(sandbox.path);
    const inspection = inspectTool(context, tool);
    expect(inspection.state).toBe('ok');
    expect(inspection.found).toBe('3.8.1');
    const failed = inspectTool(context, { ...tool, version_exit_code: 0 });
    expect(failed.state).toBe('error');
    expect(failed.note).toContain('exited 2');
});

test('a command reads each version once and the next session reads it again', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([]),
        'inspection.ts':
            'const file = Bun.file("calls.txt"); const calls = await file.exists() ? Number(await file.text()) : 0; await Bun.write("calls.txt", String(calls + 1)); console.log("3.8.1");',
    });

    using _which = useExecutable(process.execPath);
    const pin = { ...buildProgramPin('version-teller', '3.8.1'), version_command: ['inspection.ts'] };
    const session = await openSession(sandbox.path);
    expect(inspectTool(session, pin).state).toBe('ok');
    expect(inspectTool(session, pin).state).toBe('ok');
    expect(await readFile(join(sandbox.path, 'calls.txt'), 'utf8')).toBe('1');
    const next = await openSession(sandbox.path);
    expect(inspectTool(next, pin).state).toBe('ok');
    expect(await readFile(join(sandbox.path, 'calls.txt'), 'utf8')).toBe('2');
});

test.each([
    ['3.2.57', 'outdated'],
    ['5.2.0', 'system'],
] as const)('a system bash that prints %s is %s against the 4.4 floor', async (version, state) => {
    await using sandbox = await testdir();
    using _which = useExecutable(process.execPath);
    const tool: ToolDeclaration = {
        name: 'bash',
        kind: 'program',
        system: true,
        min_version: '4.4',
        installers: {},
        version_command: ['-e', `console.log("GNU bash, version ${version}(1)-release")`],
        version_pattern: String.raw`version (\d+\.\d+(?:\.\d+)?)`,
    };
    const inspection = inspectTool(buildInspectionContext(sandbox.path), tool);
    expect(inspection).toMatchObject({ state, found: version, floor: '4.4' });
});

// One release below the declared floor, computed so the test does not copy its value.
function computeVersionBelow(floor: string): string {
    const parts = floor.split('.').map(Number);
    const index = parts.findLastIndex((part) => part > 0);
    parts[index]! -= 1;
    return parts.join('.');
}

test.each(['gitleaks', 'next'])('the %s pin is outdated below its floor and accepted at it', async (name) => {
    await using sandbox = await testdir();
    using _which = useExecutable(process.execPath);
    const pin = getToolDeclaration(readManifests().values(), name);
    const floor = pin.min_version!;
    const available = pin.system === true ? 'system' : 'ok';
    for (const version of [computeVersionBelow(floor), floor]) {
        const printed = name === 'next' ? `Next.js v${version}` : version;
        const tool = { ...pin, version_command: ['-e', `console.log(${JSON.stringify(printed)});`] };
        expect(inspectTool(buildInspectionContext(sandbox.path), tool)).toMatchObject({
            state: version === floor ? available : 'outdated',
            found: version,
            floor,
        });
    }
});

test.each([
    ['0.9.0', 'ok'],
    ['0.8.0', 'outdated'],
] as const)('a wrapper with its own version runs program %s and reports %s', async (version, state) => {
    await using sandbox = await testdir({
        '.gspot/node_modules/wrapper/package.json': '{"name":"wrapper","version":"0.7.0"}',
    });

    await fakeTool(sandbox.path, '.gspot/node_modules/.bin/wrapped', `console.log(${JSON.stringify(version)});\n`);
    const tool = buildProgramPin('wrapped', '0.10.0');
    tool.min_version = '0.9.0';
    tool.installers['npm'] = { name: 'wrapper', version: '0.7.0' };
    const inspection = inspectTool(buildInspectionContext(sandbox.path), tool);
    expect(inspection.found).toBe(version);
    expect(inspection.state).toBe(state);
});
