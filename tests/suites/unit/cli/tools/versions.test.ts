import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { executableLayout } from '#cli/system/processes/programs.ts';
import { inspectTool } from '#cli/tools/inspect.ts';
import type { Tool } from '#cli/types/manifests.ts';
import { VERSION_OUTPUTS } from '#tests/config/tools.ts';
import { buildProgramPin, buildToolSearch } from '#tests/setup/cli/tools.ts';
import { fakeExecutableLookup, fakeNpmPackage, writeProgramCommand } from '#tests/setup/system/fakes.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';

test.each([
    ['1.2.3', 'outdated'],
    ['9.9.9', 'newer'],
])(
    'a pinned program on PATH that prints %s is %s, and in a mise folder it is the pin unless the version runs',
    async (version, state) => {
        await using sandbox = await testdir();
        await writeProgramCommand(sandbox.path, 'bin/teller', 'fakes/tool', '--line', version);
        using _which = fakeExecutableLookup(join(sandbox.path, 'bin', isWindows ? 'teller.cmd' : 'teller'));
        const tool = { ...buildProgramPin('teller', '5.0.1'), min_version: '5.0.0' };
        const onPath = await inspectTool(buildToolSearch(sandbox.path), tool);
        expect(onPath).toMatchObject({ state, found: version });
        const search = buildToolSearch(sandbox.path, { miseBinPaths: [join(sandbox.path, 'bin')] });
        expect(await inspectTool(search, tool)).toMatchObject({ state: 'ok', found: '5.0.1' });
        expect(await inspectTool({ ...search, runsVersionCommand: true }, tool)).toMatchObject({
            state,
            found: version,
        });
    },
);

test('a run keeps the version of an npm package, and reports a package that cannot start', async () => {
    await using sandbox = await testdir();
    const search = buildToolSearch(sandbox.path, { runsVersionCommand: true });
    await fakeNpmPackage(sandbox.path, { name: 'teller', version: '5.0.1', toolArguments: ['--line', '4.4.2'] });
    expect(await inspectTool(search, buildProgramPin('teller', '5.0.1', 'teller'))).toMatchObject({
        state: 'ok',
        found: '5.0.1',
    });
    await fakeNpmPackage(sandbox.path, { name: 'broken', version: '5.0.1', toolArguments: ['--exit', '3'] });
    expect(await inspectTool(search, buildProgramPin('broken', '5.0.1', 'broken'))).toMatchObject({
        state: 'error',
        note: 'The version command of broken exited 3.',
    });
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
            note: note === undefined ? undefined : (expect.stringContaining(note) as string),
        });
    },
);

test('a system program below its minimum version is outdated, and one above it is a system tool', async () => {
    await using sandbox = await testdir();
    using _which = fakeExecutableLookup(process.execPath);
    const states: string[] = [];
    for (const version of ['3.2.57', '5.2.0']) {
        const tool: Tool = {
            name: 'teller',
            kind: 'program',
            system: true,
            min_version: '4.4',
            installers: {},
            version_command: buildProgramCommand('fakes/tool', '--line', version).slice(1),
        };
        const inspection = await inspectTool(buildToolSearch(sandbox.path), tool);
        expect(inspection).toMatchObject({ found: version, minimumVersion: '4.4' });
        states.push(inspection.state);
    }
    expect(states).toStrictEqual(['outdated', 'system']);
});

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
