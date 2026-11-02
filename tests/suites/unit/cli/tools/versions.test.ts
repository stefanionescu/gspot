import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { inspectTool } from '#cli/tools/inspect.ts';
import { type Tool } from '#cli/types/manifests.ts';
import { executableLayout } from '#cli/system/paths.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { buildProgramPin, buildToolSearch } from '#tests/setup/cli/tools.ts';
import { VERSION_OUTPUTS, SYSTEM_BASH_VERSIONS } from '#tests/config/tools/versions.ts';
import { fakeNpmPackage, writeProgramCommand, fakeExecutableLookup } from '#tests/setup/system/fakes.ts';

test('an npm tool is the version its package holds, whatever it prints', async () => {
    await using sandbox = await testdir();
    await fakeNpmPackage(sandbox.path, { name: 'teller', version: '5.0.1', toolArguments: ['--line', '4.4.2'] });
    const inspection = await inspectTool(buildToolSearch(sandbox.path), buildProgramPin('teller', '5.0.1', 'teller'));
    expect(inspection.found).toBe('5.0.1');
    expect(inspection.state).toBe('ok');
});

test.each([
    ['1.2.3', 'outdated'],
    ['9.9.9', 'newer'],
])('a pinned program on PATH that prints %s is %s, and in a mise folder it is the pin', async (version, state) => {
    await using sandbox = await testdir();
    await writeProgramCommand(sandbox.path, 'bin/teller', 'fakes/tool', '--line', version);
    using _which = fakeExecutableLookup(join(sandbox.path, 'bin', isWindows ? 'teller.cmd' : 'teller'));
    const tool = { ...buildProgramPin('teller', '5.0.1'), min_version: '5.0.0' };
    const onPath = await inspectTool(buildToolSearch(sandbox.path), tool);
    expect(onPath).toMatchObject({ state, found: version });
    const search = buildToolSearch(sandbox.path, { miseBinPaths: [join(sandbox.path, 'bin')] });
    expect(await inspectTool(search, tool)).toMatchObject({ state: 'ok', found: '5.0.1' });
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
    const inspection = await inspectTool(buildToolSearch(sandbox.path), buildProgramPin('shimmed', '3.8.1'));
    expect(inspection.state).toBe('missing');
    expect(inspection.want).toBe('3.8.1');
});

test.each([...VERSION_OUTPUTS])(
    'version output with $name gives the state $state',
    async ({ toolArguments, state, found, note }) => {
        await using sandbox = await testdir();
        using _which = fakeExecutableLookup(process.execPath);
        const tool: Tool = {
            name: 'version-teller',
            kind: 'program',
            system: true,
            installers: {},
            version_command: buildProgramCommand('fakes/tool', ...toolArguments).slice(1),
        };
        const inspection = await inspectTool(buildToolSearch(sandbox.path), tool);
        expect({ state: inspection.state, found: inspection.found, note: inspection.note }).toStrictEqual({
            state,
            found,
            note,
        });
    },
);

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
            version_command: buildProgramCommand(
                'fakes/tool',
                '--line',
                `GNU bash, version ${version}(1)-release`,
            ).slice(1),
            version_pattern: String.raw`version (\d+\.\d+(?:\.\d+)?)`,
        };
        const inspection = await inspectTool(buildToolSearch(sandbox.path), tool);
        expect(inspection).toMatchObject({ state, found: version, minimumVersion: '4.4' });
    },
);

test('a Python tool is the version of its dist-info folder, whatever it prints', async () => {
    await using sandbox = await testdir({
        '.gspot/.venv/lib/python3.13/site-packages/some_tool-1.2.3.dist-info/METADATA': '',
    });
    await writeProgramCommand(
        sandbox.path,
        `.gspot/.venv/${executableLayout.environmentFolder}/some-tool`,
        'fakes/tool',
        '--line',
        '9.9.9',
    );
    const tool: Tool = {
        name: 'some-tool',
        kind: 'program',
        version: '1.2.4',
        installers: { pypi: { name: 'some-tool', version: '1.2.4' } },
    };
    const inspection = await inspectTool(buildToolSearch(sandbox.path), tool);
    expect(inspection).toMatchObject({ found: '1.2.3', state: 'outdated' });
});
