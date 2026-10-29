import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { inspectTool } from '#cli/tools/inspect.ts';
import { getTool } from '#cli/configurations/tools.ts';
import { openSession } from '#cli/planning/session.ts';
import { type Tool } from '#cli/types/configurations.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { UNCLOSED_SEQUENCE } from '#tests/config/yaml.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { buildProgramArguments } from '#tests/setup/system/programs.ts';
import { buildProgramPin, buildToolSearch } from '#tests/setup/cli/tools.ts';
import { fakeNpmPackage, writeProgramCommand, fakeExecutableLookup } from '#tests/setup/system/fakes.ts';
import { VERSION_OUTPUTS, SYSTEM_BASH_VERSIONS, PROGRAM_VERSION_STATES } from '#tests/config/tools/versions.ts';

test('an npm tool is the version its package holds, whatever it prints', async () => {
    await using sandbox = await testdir();
    await fakeNpmPackage(sandbox.path, { name: 'teller', version: '5.0.1', toolArguments: ['--line', '4.4.2'] });
    const inspection = inspectTool(buildToolSearch(sandbox.path), buildProgramPin('teller', '5.0.1', 'teller'));
    expect(inspection.found).toBe('5.0.1');
    expect(inspection.state).toBe('ok');
});

test('a program of the tool project reports its version from the gspot folder, past a config file in the repository', async () => {
    await using sandbox = await testdir({ '.teller.yml': UNCLOSED_SEQUENCE });
    await fakeNpmPackage(sandbox.path, {
        name: 'teller',
        version: '5.0.1',
        toolArguments: ['--refuse-file', '.teller.yml', '--refuse-exit', '97', '--line', '5.0.1'],
    });
    const inspection = inspectTool(buildToolSearch(sandbox.path), buildProgramPin('teller', '5.0.1', 'teller'));
    expect({ state: inspection.state, found: inspection.found }).toStrictEqual({ state: 'ok', found: '5.0.1' });
});

test('a shim that no configuration gives a version is missing, not broken', async () => {
    await using sandbox = await testdir();
    await writeProgramCommand(
        sandbox.path,
        'node_modules/.bin/shimmed',
        'fakes/tool',
        '--stderr',
        'mise ERROR No version is set for shim: shimmed\n',
        '--exit',
        '1',
    );
    const inspection = inspectTool(buildToolSearch(sandbox.path), buildProgramPin('shimmed', '3.8.1'));
    expect(inspection.state).toBe('missing');
    expect(inspection.want).toBe('3.8.1');
});

test.each([...VERSION_OUTPUTS])(
    'version output with $name gives the state $state',
    async ({ toolArguments, state, found, note }) => {
        await using sandbox = await testdir();
        using _which = fakeExecutableLookup(process.execPath);
        const tool = {
            ...buildProgramPin('version-teller', '3.8.1'),
            version_command: buildProgramArguments('fakes/tool', ...toolArguments),
        };
        const inspection = inspectTool(buildToolSearch(sandbox.path), tool);
        expect({ state: inspection.state, found: inspection.found, note: inspection.note }).toStrictEqual({
            state,
            found,
            note,
        });
    },
);

test('an npm package version does not hide a failed program', async () => {
    await using sandbox = await testdir();
    await fakeNpmPackage(sandbox.path, {
        name: 'teller',
        version: '5.0.1',
        toolArguments: ['--line', '5.0.1', '--exit', '7'],
    });
    const inspection = inspectTool(buildToolSearch(sandbox.path), buildProgramPin('teller', '5.0.1', 'teller'));
    expect(inspection.state).toBe('error');
    expect(inspection.note).toBe('The version command of teller exited 7: 5.0.1');
});

test('a manifest can declare the exit code of its version command without accepting other failures', async () => {
    await using sandbox = await testdir();
    using _which = fakeExecutableLookup(process.execPath);
    const tool = {
        ...buildProgramPin('version-help', '3.8.1'),
        version_command: buildProgramArguments('fakes/tool', '--line', 'version-help 3.8.1', '--exit', '2'),
        version_exit_code: 2,
    };
    const context = buildToolSearch(sandbox.path);
    const inspection = inspectTool(context, tool);
    expect(inspection.state).toBe('ok');
    expect(inspection.found).toBe('3.8.1');
    const failed = inspectTool(context, { ...tool, version_exit_code: 0 });
    expect(failed.state).toBe('error');
    expect(failed.note).toBe('The version command of version-help exited 2: version-help 3.8.1');
});

test('a command reads each version once and the next session reads it again', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings([]) });
    using _which = fakeExecutableLookup(process.execPath);
    const pin = {
        ...buildProgramPin('version-teller', '3.8.1'),
        version_command: buildProgramArguments('fakes/tool', '--append', 'calls.txt=.', '--line', '3.8.1'),
    };
    const session = await openSession(sandbox.path);
    expect(inspectTool(session, pin).state).toBe('ok');
    expect(inspectTool(session, pin).state).toBe('ok');
    expect(await readFile(join(sandbox.path, 'calls.txt'), 'utf8')).toBe('.');
    const next = await openSession(sandbox.path);
    expect(inspectTool(next, pin).state).toBe('ok');
    expect(await readFile(join(sandbox.path, 'calls.txt'), 'utf8')).toBe('..');
});

test.each([...SYSTEM_BASH_VERSIONS])(
    'a system bash that prints %s is %s against the 4.4 minimum',
    async (version, state) => {
        await using sandbox = await testdir();
        using _which = fakeExecutableLookup(process.execPath);
        const tool: Tool = {
            name: 'bash',
            kind: 'program',
            system: true,
            min_version: '4.4',
            installers: {},
            version_command: buildProgramArguments('fakes/tool', '--line', `GNU bash, version ${version}(1)-release`),
            version_pattern: String.raw`version (\d+\.\d+(?:\.\d+)?)`,
        };
        const inspection = inspectTool(buildToolSearch(sandbox.path), tool);
        expect(inspection).toMatchObject({ state, found: version, minimumVersion: '4.4' });
    },
);

test.each(['gitleaks', 'next'])('the %s pin is outdated below its minimum version and accepted at it', async (name) => {
    await using sandbox = await testdir();
    using _which = fakeExecutableLookup(process.execPath);
    const pin = getTool(readConfigurations().values(), name);
    const minimum = pin.min_version!;
    const available = pin.system === true ? 'system' : 'ok';
    for (const version of ['0.0.0', minimum]) {
        const printed = name === 'next' ? `Next.js v${version}` : version;
        const tool = { ...pin, version_command: buildProgramArguments('fakes/tool', '--line', printed) };
        expect(inspectTool(buildToolSearch(sandbox.path), tool)).toMatchObject({
            state: version === minimum ? available : 'outdated',
            found: version,
            minimumVersion: minimum,
        });
    }
});

test.each([...PROGRAM_VERSION_STATES])(
    'a wrapper with its own version runs program %s and reports %s',
    async (version, state) => {
        await using sandbox = await testdir({
            [`${GSPOT_PATHS.nodeModules}/wrapper/package.json`]: '{"name":"wrapper","version":"0.7.0"}',
        });

        await writeProgramCommand(
            sandbox.path,
            `${GSPOT_PATHS.nodeModules}/.bin/wrapped`,
            'fakes/tool',
            '--line',
            version,
        );
        const tool = buildProgramPin('wrapped', '0.10.0');
        tool.min_version = '0.9.0';
        tool.installers['npm'] = { name: 'wrapper', version: '0.7.0' };
        const inspection = inspectTool(buildToolSearch(sandbox.path), tool);
        expect(inspection.found).toBe(version);
        expect(inspection.state).toBe(state);
    },
);
