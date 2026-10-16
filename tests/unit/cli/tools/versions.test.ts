import executables from 'which';
import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { inspectTool } from '#cli/tools/inspect.ts';
import { fakeTool } from '#tests/setup/fake-tool.ts';
import { openSession } from '#cli/commands/session.ts';
import { buildProgramPin } from '#tests/setup/pins.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { chmod, mkdir, symlink } from 'node:fs/promises';
import { parseVersionOutput } from '#cli/tools/versions.ts';
import { EXECUTABLE_FILE } from '#cli/config/system/modes.ts';
import { isWindows } from '#tests/setup/operating-systems.ts';
import { toolDeclaration } from '#cli/configurations/tool-pins.ts';
import { type ToolDeclaration } from '#cli/types/configurations.ts';
import { rootSettingSchemas } from '#cli/settings/schema/gspot-toml.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { VERSION_OUTPUTS, VERSION_RESPONSE, MISSING_TOOL_VERSION } from '#tests/config/tools.ts';

test('when the npm package version differs from the pin, the version comes from the command output', () => {
    const tool = {
        ...buildProgramPin('wrapper', '4.4.2', 'package'),
        installers: { npm: { name: 'package', version: '7.0.0' } },
    };
    expect(parseVersionOutput(tool, VERSION_RESPONSE, '7.0.0')).toStrictEqual({ version: '4.4.2' });
    expect(parseVersionOutput(tool, { ...VERSION_RESPONSE, stdout: 'no version' })).toStrictEqual({
        state: 'error',
        note: 'wrapper did not report a valid version: no version',
    });
});

test('color codes and a version pattern are applied before the version is checked', () => {
    const tool = { ...buildProgramPin('teller', '4.4.2'), version_pattern: String.raw`version=(\d+\.\d+\.\d+)` };
    expect(parseVersionOutput(tool, { ...VERSION_RESPONSE, stdout: '\u001B[32mversion=4.4.2\u001B[0m' })).toStrictEqual(
        { version: '4.4.2' },
    );
});

test('a mise shim with no version set reports not installed', () => {
    expect(
        parseVersionOutput(buildProgramPin('teller', '4.4.2'), {
            ...VERSION_RESPONSE,
            code: 1,
            stdout: '',
            stderr: MISSING_TOOL_VERSION,
        }),
    ).toStrictEqual({ state: 'missing', note: 'not installed' });
});

test('an npm tool is the version its package holds, whatever it prints', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/teller/package.json': '{"name":"teller","version":"5.0.1"}',
        '.gspot/node_modules/teller/run.sh': '#!/bin/sh\necho 4.4.2\n',
    });
    await chmod(join(sandbox.path, '.gspot/node_modules/teller/run.sh'), EXECUTABLE_FILE);
    await mkdir(join(sandbox.path, '.gspot/node_modules/.bin'));
    await symlink('../teller/run.sh', join(sandbox.path, '.gspot/node_modules/.bin/teller'));
    const inspection = inspectTool(
        {
            root: sandbox.path,
            timeoutSeconds: rootSettingSchemas.tool_timeout_seconds.parse(undefined),
            inspections: new Map(),
        },
        buildProgramPin('teller', '5.0.1', 'teller'),
    );
    expect(inspection.found).toBe('5.0.1');
    expect(inspection.state).toBe('ok');
});

test('a shim that no configuration gives a version is missing, not broken', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'node_modules/.bin/shimmed': "#!/bin/sh\necho 'mise ERROR No version is set for shim: shimmed' >&2\nexit 1\n",
    });
    await chmod(join(sandbox.path, 'node_modules/.bin/shimmed'), EXECUTABLE_FILE);
    const inspection = inspectTool(
        {
            root: sandbox.path,
            timeoutSeconds: rootSettingSchemas.tool_timeout_seconds.parse(undefined),
            inspections: new Map(),
        },
        buildProgramPin('shimmed', '3.8.1'),
    );
    expect(inspection.state).toBe('missing');
    expect(inspection.want).toBe('3.8.1');
});

test('color codes around a version are no part of it', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'node_modules/.bin/painter': "#!/bin/sh\nprintf 'painter \\033[1;36m26.8.0\\033[0m using more\\n'\n",
    });
    await chmod(join(sandbox.path, 'node_modules/.bin/painter'), EXECUTABLE_FILE);
    const inspection = inspectTool(
        {
            root: sandbox.path,
            timeoutSeconds: rootSettingSchemas.tool_timeout_seconds.parse(undefined),
            inspections: new Map(),
        },
        buildProgramPin('painter', '26.8.0'),
    );
    expect(inspection.found).toBe('26.8.0');
    expect(inspection.state).toBe('ok');
});

test.each(VERSION_OUTPUTS)('version output %s gives the state %s', async (script, state, found, note) => {
    await using sandbox = await testdir();
    using _which = spyOn(executables, 'sync').mockImplementation(((...[, options]: [string, executables.Options?]) =>
        options?.all === true ? [process.execPath] : process.execPath) as typeof executables.sync);
    const tool = { ...buildProgramPin('version-teller', '3.8.1'), version_command: ['-e', script] };
    const inspection = inspectTool(
        {
            root: sandbox.path,
            timeoutSeconds: rootSettingSchemas.tool_timeout_seconds.parse(undefined),
            inspections: new Map(),
        },
        tool,
    );
    expect(inspection.state).toBe(state);
    expect(inspection.found).toBe(found);
    expect(inspection.note).toBe(note);
});

test('an npm package version does not hide a failed program', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/teller/package.json': '{"name":"teller","version":"5.0.1"}',
        '.gspot/node_modules/teller/run.sh': '#!/bin/sh\necho 5.0.1\nexit 7\n',
    });
    await chmod(join(sandbox.path, '.gspot/node_modules/teller/run.sh'), EXECUTABLE_FILE);
    await mkdir(join(sandbox.path, '.gspot/node_modules/.bin'));
    await symlink('../teller/run.sh', join(sandbox.path, '.gspot/node_modules/.bin/teller'));
    const inspection = inspectTool(
        {
            root: sandbox.path,
            timeoutSeconds: rootSettingSchemas.tool_timeout_seconds.parse(undefined),
            inspections: new Map(),
        },
        buildProgramPin('teller', '5.0.1', 'teller'),
    );
    expect(inspection.state).toBe('error');
    expect(inspection.note).toContain('exited 7');
});

test('a manifest can declare the exit code of its version command without accepting other failures', async () => {
    await using sandbox = await testdir();
    using _which = spyOn(executables, 'sync').mockImplementation(((...[, options]: [string, executables.Options?]) =>
        options?.all === true ? [process.execPath] : process.execPath) as typeof executables.sync);
    const tool = {
        ...buildProgramPin('version-help', '3.8.1'),
        version_command: ['-e', 'console.log("version-help 3.8.1"); process.exitCode = 2;'],
        version_exit_code: 2,
    };
    const context = {
        root: sandbox.path,
        timeoutSeconds: rootSettingSchemas.tool_timeout_seconds.parse(undefined),
        inspections: new Map(),
    };
    const inspection = inspectTool(context, tool);
    expect(inspection.state).toBe('ok');
    expect(inspection.found).toBe('3.8.1');
    const failed = inspectTool(context, { ...tool, version_exit_code: 0 });
    expect(failed.state).toBe('error');
    expect(failed.note).toContain('exited 2');
});

test('a command reads each version once and the next session reads it again', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText([]),
        'inspection.ts':
            'const file = Bun.file("calls.txt"); const calls = await file.exists() ? Number(await file.text()) : 0; await Bun.write("calls.txt", String(calls + 1)); console.log("3.8.1");',
    });
    using _which = spyOn(executables, 'sync').mockImplementation(((...[, options]: [string, executables.Options?]) =>
        options?.all === true ? [process.execPath] : process.execPath) as typeof executables.sync);
    const pin = { ...buildProgramPin('version-teller', '3.8.1'), version_command: ['inspection.ts'] };
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
    ['5.2.0', 'system'],
] as const)('a system bash that prints %s is %s against the 4.4 floor', async (version, state) => {
    await using sandbox = await testdir();
    using _which = spyOn(executables, 'sync').mockImplementation(((...[, options]: [string, executables.Options?]) =>
        options?.all === true ? [process.execPath] : process.execPath) as typeof executables.sync);
    const tool: ToolDeclaration = {
        name: 'bash',
        kind: 'program',
        system: true,
        min_version: '4.4',
        installers: {},
        version_command: ['-e', `console.log("GNU bash, version ${version}(1)-release")`],
        version_pattern: String.raw`version (\d+\.\d+(?:\.\d+)?)`,
    };
    const inspection = inspectTool(
        {
            root: sandbox.path,
            timeoutSeconds: rootSettingSchemas.tool_timeout_seconds.parse(undefined),
            inspections: new Map(),
        },
        tool,
    );
    expect(inspection).toMatchObject({ state, found: version, floor: '4.4' });
});

test('an npm tool behind a shim file takes the version of its package', async () => {
    await using sandbox = await testdir();
    // npm and Bun write a shim file on Windows, where a symlink into the package serves on other systems.
    const binEntry = isWindows
        ? { '.gspot/node_modules/.bin/teller.cmd': '@echo unknown\r\n' }
        : { '.gspot/node_modules/.bin/teller': '#!/bin/sh\necho unknown\n' };
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/teller/package.json': '{"name":"teller","version":"5.0.1"}',
        ...binEntry,
    });
    for (const path of Object.keys(binEntry)) await chmod(join(sandbox.path, path), EXECUTABLE_FILE);
    const inspection = inspectTool(
        {
            root: sandbox.path,
            timeoutSeconds: rootSettingSchemas.tool_timeout_seconds.parse(undefined),
            inspections: new Map(),
        },
        buildProgramPin('teller', '5.0.1', 'teller'),
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

test.each(['gitleaks', 'next'])('the %s pin is outdated below its floor and accepted at it', async (name) => {
    await using sandbox = await testdir();
    using _which = spyOn(executables, 'sync').mockImplementation(((...[, options]: [string, executables.Options?]) =>
        options?.all === true ? [process.execPath] : process.execPath) as typeof executables.sync);
    const pin = toolDeclaration(configurationManifests().values(), name);
    const floor = pin.min_version!;
    const available = pin.system === true ? 'system' : 'ok';
    for (const version of [belowFloor(floor), floor]) {
        const printed = name === 'next' ? `Next.js v${version}` : version;
        const tool = { ...pin, version_command: ['-e', `console.log(${JSON.stringify(printed)});`] };
        expect(
            inspectTool(
                {
                    root: sandbox.path,
                    timeoutSeconds: rootSettingSchemas.tool_timeout_seconds.parse(undefined),
                    inspections: new Map(),
                },
                tool,
            ),
        ).toMatchObject({
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
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/wrapper/package.json': '{"name":"wrapper","version":"0.7.0"}',
    });
    await fakeTool(sandbox.path, '.gspot/node_modules/.bin/wrapped', 'console.log(process.env.WRAPPER_VERSION);\n');
    const tool = buildProgramPin('wrapped', '0.10.0');
    tool.min_version = '0.9.0';
    tool.env = { WRAPPER_VERSION: version };
    tool.installers['npm'] = { name: 'wrapper', version: '0.7.0' };
    const inspection = inspectTool(
        {
            root: sandbox.path,
            timeoutSeconds: rootSettingSchemas.tool_timeout_seconds.parse(undefined),
            inspections: new Map(),
        },
        tool,
    );
    expect(inspection.found).toBe(version);
    expect(inspection.state).toBe(state);
});
