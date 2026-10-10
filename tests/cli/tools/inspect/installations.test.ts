import executables from 'which';
import { join } from 'node:path';
import { readPolicy } from '#cli/policy/public.ts';
import { inspectTool } from '#cli/tools/public.ts';
import { testdir, createFileTree } from 'testdirs';
import * as environment from '#cli/platform/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { test, spyOn, expect, describe } from 'bun:test';
import { toolPin } from '#cli/configurations/contracts.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { isPosix } from '#tests/config/harness/platforms.ts';
import { EXECUTABLE_FILE } from '#cli/config/platform/modes.ts';
import { chmod, mkdir, unlink, symlink } from 'node:fs/promises';
import { runTool, locateCandidates } from '#cli/tools/contracts.ts';
import { configurationManifests } from '#cli/configurations/public.ts';
import { getOwnership, openOwnership } from '#cli/lifecycle/ownership/public.ts';
import { buildBinaryPin, buildLibraryPin, inspectionContext } from '#tests/harness/pins.ts';

const toolCompanions = async () => {
    await using sandbox = await testdir();
    const launcher = `#!${process.execPath}\nconst child = Bun.spawnSync(['companion'], {stdout:'pipe', stderr:'pipe'}); process.stdout.write(child.stdout); process.exitCode = child.exitCode;\n`;
    await createFileTree(sandbox.path, {
        'node_modules/.bin/teller': launcher,
        'node_modules/.bin/companion': `#!${process.execPath}\nconsole.log('3.8.1');\n`,
        'unrelated/companion': `#!${process.execPath}\nconsole.log('9.0.0');\n`,
    });
    for (const path of ['node_modules/.bin/teller', 'node_modules/.bin/companion', 'unrelated/companion'])
        await chmod(join(sandbox.path, path), EXECUTABLE_FILE);
    const env = { PATH: join(sandbox.path, 'unrelated') };
    const tool = { ...buildBinaryPin('teller', '3.8.1'), env };
    const read = inspectTool(inspectionContext(sandbox.path), tool);
    expect(read).toMatchObject({ state: 'ok', found: '3.8.1' });
    const executed = await runTool([read.path!], { cwd: sandbox.path, env });
    expect(executed.code).toBe(0);
    expect(executed.stdout.trim()).toBe('3.8.1');
    expect(await Bun.file(join(sandbox.path, 'node_modules/.bin/teller')).text()).toBe(launcher);
};

const activeExecutable = async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'active/teller': '#!/bin/sh\necho 3.8.1\n',
        'mise/shims/teller': '#!/bin/sh\necho 1.0.0\n',
    });
    const active = join(sandbox.path, 'active/teller');
    await chmod(active, EXECUTABLE_FILE);
    await chmod(join(sandbox.path, 'mise/shims/teller'), EXECUTABLE_FILE);
    using _which = spyOn(executables, 'sync').mockReturnValue(active);
    using _home = spyOn(environment, 'miseHome').mockReturnValue(join(sandbox.path, 'mise'));
    const inspection = inspectTool(inspectionContext(sandbox.path), buildBinaryPin('teller', '3.8.1'));
    expect(inspection.state).toBe('ok');
    expect(inspection.path).toBe(active);
};

const linkedManifest = async () => {
    await using sandbox = await testdir();
    await using outside = await testdir();
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/teller/run.sh': '#!/bin/sh\n>executed\necho 5.0.1\n',
    });
    await createFileTree(outside.path, { 'package.json': '{"name":"teller","version":"5.0.1"}' });
    const manifest = join(sandbox.path, '.gspot/node_modules/teller/package.json');
    await chmod(join(sandbox.path, '.gspot/node_modules/teller/run.sh'), EXECUTABLE_FILE);
    await mkdir(join(sandbox.path, '.gspot/node_modules/.bin'));
    await symlink('../teller/run.sh', join(sandbox.path, '.gspot/node_modules/.bin/teller'));
    await symlink(join(outside.path, 'package.json'), manifest);
    const context = inspectionContext(sandbox.path);
    const tool = buildBinaryPin('teller', '5.0.1', 'teller');
    expect(() => inspectTool(context, tool)).toThrow('private regular file');
    expect(await pathExists(join(sandbox.path, 'executed'))).toBe(false);
    await unlink(manifest);
    await Bun.write(manifest, '{"name":"teller","version":"5.0.1"}');
    expect(inspectTool(context, tool)).toMatchObject({ state: 'ok', found: '5.0.1' });
    expect(await pathExists(join(sandbox.path, 'executed'))).toBe(true);
    expect(await Bun.file(join(outside.path, 'package.json')).text()).toBe('{"name":"teller","version":"5.0.1"}');
};

const packageVersion = async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/teller/package.json': '{"name":"teller","version":"5.0.1"}',
        '.gspot/node_modules/teller/run.sh': '#!/bin/sh\necho 4.4.2\n',
    });
    await chmod(join(sandbox.path, '.gspot/node_modules/teller/run.sh'), EXECUTABLE_FILE);
    await mkdir(join(sandbox.path, '.gspot/node_modules/.bin'));
    await symlink('../teller/run.sh', join(sandbox.path, '.gspot/node_modules/.bin/teller'));
    const inspection = inspectTool(inspectionContext(sandbox.path), buildBinaryPin('teller', '5.0.1', 'teller'));
    expect(inspection.found).toBe('5.0.1');
    expect(inspection.state).toBe('ok');
};

const missingVersion = async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'node_modules/.bin/shimmed': "#!/bin/sh\necho 'mise ERROR No version is set for shim: shimmed' >&2\nexit 1\n",
    });
    await chmod(join(sandbox.path, 'node_modules/.bin/shimmed'), EXECUTABLE_FILE);
    const inspection = inspectTool(inspectionContext(sandbox.path), buildBinaryPin('shimmed', '3.8.1'));
    expect(inspection.state).toBe('missing');
    expect(inspection.want).toBe('3.8.1');
};

const versionColors = async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'node_modules/.bin/painter': "#!/bin/sh\nprintf 'painter \\033[1;36m26.8.0\\033[0m using more\\n'\n",
    });
    await chmod(join(sandbox.path, 'node_modules/.bin/painter'), EXECUTABLE_FILE);
    const inspection = inspectTool(inspectionContext(sandbox.path), buildBinaryPin('painter', '26.8.0'));
    expect(inspection.found).toBe('26.8.0');
    expect(inspection.state).toBe('ok');
};

const installedLibrary = async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/globals/package.json': '{"name":"globals","version":"17.12.0"}',
        'api/node_modules/eslint-plugin-n/package.json': '{"name":"eslint-plugin-n","version":"18.3.0"}',
    });
    expect(inspectTool(inspectionContext(sandbox.path), buildLibraryPin('globals', '17.12.0')).state).toBe('ok');
    expect(inspectTool(inspectionContext(sandbox.path), buildLibraryPin('eslint-plugin-n', '18.3.0')).state).toBe(
        'missing',
    );
};

const libraryVersion = async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/typescript/package.json': '{"name":"typescript","version":"6.0.0"}',
    });
    const absent = inspectTool(inspectionContext(sandbox.path), buildLibraryPin('eslint-plugin-regexp', '3.3.0'));
    expect(absent.state).toBe('missing');
    expect(absent.want).toBe('3.3.0');
    const newer = inspectTool(inspectionContext(sandbox.path), buildLibraryPin('typescript', '5.9.3'));
    expect(newer.state).toBe('newer');
    expect(newer.found).toBe('6.0.0');
};

describe('the tool inspection', () => {
    test.skipIf(!isPosix)(
        'version inspections and tool execution prefer helpers from the selected installation',
        toolCompanions,
    );

    test('an active PATH executable wins over an unrelated mise shim', activeExecutable);

    test(
        'a managed npm inspection refuses a linked manifest before executing and passes after the fix',
        linkedManifest,
    );

    test('an npm tool is the version its package holds, whatever it prints about itself', packageVersion);

    test.each([
        ['0.9.0', 'ok'],
        ['0.8.0', 'outdated'],
    ] as const)('an independently versioned wrapper runs native %s and reports %s', async (native, state) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            '.gspot/node_modules/wrapper/package.json': '{"name":"wrapper","version":"0.7.0"}',
            '.gspot/node_modules/wrapper/run.sh': '#!/bin/sh\necho "$WRAPPER_NATIVE_VERSION"\n',
        });
        await chmod(join(sandbox.path, '.gspot/node_modules/wrapper/run.sh'), EXECUTABLE_FILE);
        await mkdir(join(sandbox.path, '.gspot/node_modules/.bin'));
        await symlink('../wrapper/run.sh', join(sandbox.path, '.gspot/node_modules/.bin/wrapped'));
        const tool = buildBinaryPin('wrapped', '0.10.0');
        tool.min_version = '0.9.0';
        tool.env = { WRAPPER_NATIVE_VERSION: native };
        tool.installers['npm'] = { name: 'wrapper', version: '0.7.0' };
        const inspection = inspectTool(inspectionContext(sandbox.path), tool);
        expect(inspection.found).toBe(native);
        expect(inspection.state).toBe(state);
    });

    test('a shim that no configuration gives a version is missing, not broken', missingVersion);

    test('color codes around a version are no part of it', versionColors);

    test('a library is found only in its tool project installation', installedLibrary);

    test('a library that is absent is missing, and one off its pin is reported', libraryVersion);
});

test.each(['mise', 'npm'])(
    'a pending npm install blocks only tools selected from that installation under %s',
    async (runner) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy([], { tables: `runner = "${runner}"\n` }),
            'node_modules/.bin/teller': '#!/bin/sh\necho 3.8.1\n',
            'node_modules/.bin/editorconfig-checker': '#!/bin/sh\necho 3.4.0\n',
            '.gspot/node_modules/.bin/teller': '#!/bin/sh\necho 3.8.1\n',
            '.gspot/node_modules/.bin/editorconfig-checker': '#!/bin/sh\nexit 99\n',
            '.gspot/node_modules/globals/package.json': '{"name":"globals","version":"17.12.0"}',
        });
        await chmod(join(sandbox.path, 'node_modules/.bin/teller'), EXECUTABLE_FILE);
        await chmod(join(sandbox.path, 'node_modules/.bin/editorconfig-checker'), EXECUTABLE_FILE);
        await chmod(join(sandbox.path, '.gspot/node_modules/.bin/teller'), EXECUTABLE_FILE);
        await chmod(join(sandbox.path, '.gspot/node_modules/.bin/editorconfig-checker'), EXECUTABLE_FILE);
        {
            using log = openOwnership(sandbox.path);
            log.state.installing = ['npm'];
            log.save();
        }
        const context = {
            ...inspectionContext(sandbox.path),
            policyFiles: readPolicy(sandbox.path),
            getPendingInstallations: (path: string) => getOwnership(path).installing,
        };
        const tool = buildBinaryPin('teller', '3.8.1', 'teller');
        tool.installers['mise'] = { name: 'teller', version: '3.8.1' };
        expect(inspectTool(context, tool).state).toBe('error');
        expect(inspectTool(context, buildLibraryPin('globals', '17.12.0')).state).toBe('error');
        const discovered = inspectTool(context, toolPin(configurationManifests().values(), 'editorconfig-checker'));
        expect(discovered.note).toContain('gspot install');
        expect(discovered.path).toBeUndefined();
        expect(discovered.state).toBe('error');
        {
            using log = openOwnership(sandbox.path);
            delete log.state.installing;
            log.save();
        }
        const installed = inspectTool(context, tool);
        expect(installed.state).toBe('ok');
        expect(installed.path).toBe(join(sandbox.path, '.gspot/node_modules/.bin/teller'));
        expect(inspectTool(context, buildLibraryPin('globals', '17.12.0')).state).toBe('ok');
    },
);

test.skipIf(!isPosix).each([0, 1])(
    'mise resolves native executables in the original repository with status %s',
    async (status) => {
        await using sandbox = await testdir();
        const executable = join(sandbox.path, 'mise/installs/teller/3.8.1/teller');
        await createFileTree(sandbox.path, {
            'work/.keep': '',
            'copy/.keep': '',
            'mise/shims/teller': `#!${process.execPath}\nthrow new Error('The shim must not run in a source copy.');\n`,
            'mise/installs/teller/3.8.1/teller': `#!${process.execPath}\nconsole.log('3.8.1');\n`,
            'bin/mise': `#!${process.execPath}\nif (process.cwd() !== ${JSON.stringify(join(sandbox.path, 'work'))}) process.exit(9); console.log(${JSON.stringify(executable)}); process.exitCode = ${String(status)};\n`,
        });
        for (const path of ['mise/shims/teller', 'mise/installs/teller/3.8.1/teller', 'bin/mise'])
            await chmod(join(sandbox.path, path), EXECUTABLE_FILE);
        using _which = spyOn(executables, 'sync')
            .mockReturnValueOnce(join(sandbox.path, 'mise/shims/teller'))
            .mockReturnValue(join(sandbox.path, 'bin/mise'));
        using _home = spyOn(environment, 'miseHome').mockReturnValue(join(sandbox.path, 'mise'));
        const candidates = locateCandidates(join(sandbox.path, 'copy'), 'teller', {
            searchFolders: [],
            installedRoot: join(sandbox.path, 'work'),
        });
        expect(candidates).toStrictEqual(status === 0 ? [executable] : []);
        if (status === 0) {
            const result = await runTool([candidates[0]!], { cwd: join(sandbox.path, 'copy') });
            expect(result.code).toBe(0);
            expect(result.stdout.trim()).toBe('3.8.1');
        }
    },
);
