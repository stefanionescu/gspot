import executables from 'which';
import { join } from 'node:path';
import { runTool } from '#cli/tools/run.ts';
import { toolPin } from '#cli/tools/pins.ts';
import { test, spyOn, expect } from 'bun:test';
import { readPolicy } from '#cli/policy/read.ts';
import { testdir, createFileTree } from 'testdirs';
import { inspectTool } from '#cli/tools/inspect.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { locateCandidates } from '#cli/tools/locate.ts';
import { buildToolsPath } from '#tests/harness/install.ts';
import * as environment from '#cli/platform/environment.ts';
import { isPosix } from '#tests/config/harness/platforms.ts';
import { EXECUTABLE_FILE } from '#cli/config/platform/modes.ts';
import { buildBinaryPin, buildLibraryPin } from '#tests/harness/pins.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { getOwnership, openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { chmodSync, mkdirSync, existsSync, unlinkSync, symlinkSync } from 'node:fs';

test.skipIf(!isPosix)(
    'the tool inspection > version inspections and tool execution prefer helpers from the selected installation',
    async () => {
        await using sandbox = await testdir();
        const launcher = `#!${process.execPath}\nconst child = Bun.spawnSync(['companion'], {stdout:'pipe', stderr:'pipe'}); process.stdout.write(child.stdout); process.exitCode = child.exitCode;\n`;
        await createFileTree(sandbox.path, {
            'node_modules/.bin/teller': launcher,
            'node_modules/.bin/companion': `#!${process.execPath}\nconsole.log('3.8.1');\n`,
            'unrelated/companion': `#!${process.execPath}\nconsole.log('9.0.0');\n`,
        });
        for (const path of ['node_modules/.bin/teller', 'node_modules/.bin/companion', 'unrelated/companion'])
            chmodSync(join(sandbox.path, path), EXECUTABLE_FILE);
        const env = { PATH: join(sandbox.path, 'unrelated') };
        const tool = { ...buildBinaryPin('teller', '3.8.1'), env };
        const read = inspectTool({ root: sandbox.path, inspections: new Map() }, tool);
        expect(read).toMatchObject({ state: 'ok', found: '3.8.1' });
        const executed = await runTool([read.path!], { cwd: sandbox.path, env });
        expect(executed.code).toBe(0);
        expect(executed.stdout.trim()).toBe('3.8.1');
        expect(await Bun.file(join(sandbox.path, 'node_modules/.bin/teller')).text()).toBe(launcher);
    },
);

test('the tool inspection > an active PATH executable wins over an unrelated mise shim', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'active/teller': '#!/bin/sh\necho 3.8.1\n',
        'mise/shims/teller': '#!/bin/sh\necho 1.0.0\n',
    });
    const active = join(sandbox.path, 'active/teller');
    chmodSync(active, EXECUTABLE_FILE);
    chmodSync(join(sandbox.path, 'mise/shims/teller'), EXECUTABLE_FILE);
    const which = spyOn(executables, 'sync').mockReturnValue(active);
    const home = spyOn(environment, 'miseHome').mockReturnValue(join(sandbox.path, 'mise'));
    try {
        const inspection = inspectTool(
            { root: sandbox.path, inspections: new Map() },
            buildBinaryPin('teller', '3.8.1'),
        );
        expect(inspection.state).toBe('ok');
        expect(inspection.path).toBe(active);
    } finally {
        which.mockRestore();
        home.mockRestore();
    }
});

test('the tool inspection > a managed npm inspection refuses a linked manifest before executing and accepts its corrected file', async () => {
    await using sandbox = await testdir();
    await using outside = await testdir();
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/teller/run.sh': '#!/bin/sh\ntouch executed\necho 5.0.1\n',
    });
    await createFileTree(outside.path, { 'package.json': '{"name":"teller","version":"5.0.1"}' });
    const manifest = join(sandbox.path, '.gspot/node_modules/teller/package.json');
    chmodSync(join(sandbox.path, '.gspot/node_modules/teller/run.sh'), EXECUTABLE_FILE);
    mkdirSync(join(sandbox.path, '.gspot/node_modules/.bin'));
    symlinkSync('../teller/run.sh', join(sandbox.path, '.gspot/node_modules/.bin/teller'));
    symlinkSync(join(outside.path, 'package.json'), manifest);
    const context = { root: sandbox.path, inspections: new Map() };
    const tool = buildBinaryPin('teller', '5.0.1', 'teller');
    expect(() => inspectTool(context, tool)).toThrow('private regular file');
    expect(existsSync(join(sandbox.path, 'executed'))).toBe(false);
    unlinkSync(manifest);
    await Bun.write(manifest, '{"name":"teller","version":"5.0.1"}');
    expect(inspectTool(context, tool)).toMatchObject({ state: 'ok', found: '5.0.1' });
    expect(existsSync(join(sandbox.path, 'executed'))).toBe(true);
    expect(await Bun.file(join(outside.path, 'package.json')).text()).toBe('{"name":"teller","version":"5.0.1"}');
});

test('the tool inspection > an npm tool is the version its package holds, whatever it prints about itself', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/teller/package.json': '{"name":"teller","version":"5.0.1"}',
        '.gspot/node_modules/teller/run.sh': '#!/bin/sh\necho 4.4.2\n',
    });
    chmodSync(join(sandbox.path, '.gspot/node_modules/teller/run.sh'), EXECUTABLE_FILE);
    mkdirSync(join(sandbox.path, '.gspot/node_modules/.bin'));
    symlinkSync('../teller/run.sh', join(sandbox.path, '.gspot/node_modules/.bin/teller'));
    const inspection = inspectTool(
        { root: sandbox.path, inspections: new Map() },
        buildBinaryPin('teller', '5.0.1', 'teller'),
    );
    expect(inspection.found).toBe('5.0.1');
    expect(inspection.state).toBe('ok');
});

test.each([
    ['0.9.0', 'ok'],
    ['0.8.0', 'outdated'],
] as const)(
    'the tool inspection > an independently versioned wrapper runs native %s and reports %s',
    async (native, state) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            '.gspot/node_modules/wrapper/package.json': '{"name":"wrapper","version":"0.7.0"}',
            '.gspot/node_modules/wrapper/run.sh': '#!/bin/sh\necho "$WRAPPER_NATIVE_VERSION"\n',
        });
        chmodSync(join(sandbox.path, '.gspot/node_modules/wrapper/run.sh'), EXECUTABLE_FILE);
        mkdirSync(join(sandbox.path, '.gspot/node_modules/.bin'));
        symlinkSync('../wrapper/run.sh', join(sandbox.path, '.gspot/node_modules/.bin/wrapped'));
        const tool = buildBinaryPin('wrapped', '0.10.0');
        tool.min_version = '0.9.0';
        tool.env = { WRAPPER_NATIVE_VERSION: native };
        tool.installers['npm'] = { name: 'wrapper', version: '0.7.0' };
        const inspection = inspectTool({ root: sandbox.path, inspections: new Map() }, tool);
        expect(inspection.found).toBe(native);
        expect(inspection.state).toBe(state);
    },
);

test('the tool inspection > a shim that no configuration gives a version is missing, not broken', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'node_modules/.bin/shimmed': "#!/bin/sh\necho 'mise ERROR No version is set for shim: shimmed' >&2\nexit 1\n",
    });
    chmodSync(join(sandbox.path, 'node_modules/.bin/shimmed'), EXECUTABLE_FILE);
    const inspection = inspectTool({ root: sandbox.path, inspections: new Map() }, buildBinaryPin('shimmed', '3.8.1'));
    expect(inspection.state).toBe('missing');
    expect(inspection.want).toBe('3.8.1');
});

test('the tool inspection > color codes around a version are no part of it', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'node_modules/.bin/painter': "#!/bin/sh\nprintf 'painter \\033[1;36m26.8.0\\033[0m using more\\n'\n",
    });
    chmodSync(join(sandbox.path, 'node_modules/.bin/painter'), EXECUTABLE_FILE);
    const inspection = inspectTool({ root: sandbox.path, inspections: new Map() }, buildBinaryPin('painter', '26.8.0'));
    expect(inspection.found).toBe('26.8.0');
    expect(inspection.state).toBe('ok');
});

test('the tool inspection > a library is found only in its private installation', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/globals/package.json': '{"name":"globals","version":"17.12.0"}',
        'api/node_modules/eslint-plugin-n/package.json': '{"name":"eslint-plugin-n","version":"18.3.0"}',
    });
    expect(
        inspectTool({ root: sandbox.path, inspections: new Map() }, buildLibraryPin('globals', '17.12.0')).state,
    ).toBe('ok');
    expect(
        inspectTool({ root: sandbox.path, inspections: new Map() }, buildLibraryPin('eslint-plugin-n', '18.3.0')).state,
    ).toBe('missing');
});

test('the tool inspection > a library that is absent is missing, and one off its pin is reported', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/typescript/package.json': '{"name":"typescript","version":"6.0.0"}',
    });
    const absent = inspectTool(
        { root: sandbox.path, inspections: new Map() },
        buildLibraryPin('eslint-plugin-regexp', '3.3.0'),
    );
    expect(absent.state).toBe('missing');
    expect(absent.want).toBe('3.3.0');
    const newer = inspectTool({ root: sandbox.path, inspections: new Map() }, buildLibraryPin('typescript', '5.9.3'));
    expect(newer.state).toBe('newer');
    expect(newer.found).toBe('6.0.0');
});

test.each(['mise', 'npm'])(
    'a pending npm install blocks only tools selected from that installation under %s',
    async (runner) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy([], { tables: `run_with = "${runner}"\n` }),
            'node_modules/.bin/teller': '#!/bin/sh\necho 3.8.1\n',
            'node_modules/.bin/ec': '#!/bin/sh\necho 3.4.0\n',
            '.gspot/node_modules/.bin/teller': `#!/bin/sh\necho ${runner === 'mise' ? '1.0.0' : '3.8.1'}\n`,
            '.gspot/node_modules/.bin/ec': '#!/bin/sh\nexit 99\n',
            '.gspot/node_modules/globals/package.json': '{"name":"globals","version":"17.12.0"}',
        });
        chmodSync(join(sandbox.path, 'node_modules/.bin/teller'), EXECUTABLE_FILE);
        chmodSync(join(sandbox.path, 'node_modules/.bin/ec'), EXECUTABLE_FILE);
        chmodSync(join(sandbox.path, '.gspot/node_modules/.bin/teller'), EXECUTABLE_FILE);
        chmodSync(join(sandbox.path, '.gspot/node_modules/.bin/ec'), EXECUTABLE_FILE);
        {
            using log = openOwnership(sandbox.path);
            log.state.installing = ['npm'];
            log.save();
        }
        const context = {
            root: sandbox.path,
            inspections: new Map(),
            policyFiles: readPolicy(sandbox.path),
            getPendingInstallations: (path: string) => getOwnership(path).installing,
        };
        const tool = buildBinaryPin('teller', '3.8.1', 'teller');
        tool.installers['mise'] = { name: 'teller', version: '3.8.1' };
        expect(inspectTool(context, tool).state).toBe(runner === 'mise' ? 'ok' : 'error');
        expect(inspectTool(context, buildLibraryPin('globals', '17.12.0')).state).toBe('error');
        const discovered = inspectTool(context, toolPin(configurationManifests().values(), 'ec'));
        expect(discovered.note).toBe(
            runner === 'mise' ? undefined : 'Tool installation is incomplete. Run: gspot install',
        );
        expect(discovered.path).toBe(runner === 'mise' ? join(sandbox.path, 'node_modules/.bin/ec') : undefined);
        expect(discovered.state).toBe(runner === 'mise' ? 'ok' : 'error');
        {
            using log = openOwnership(sandbox.path);
            delete log.state.installing;
            log.save();
        }
        expect(inspectTool(context, tool).state).toBe('ok');
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
            chmodSync(join(sandbox.path, path), EXECUTABLE_FILE);
        const which = spyOn(executables, 'sync')
            .mockReturnValueOnce(join(sandbox.path, 'mise/shims/teller'))
            .mockReturnValue(join(sandbox.path, 'bin/mise'));
        const home = spyOn(environment, 'miseHome').mockReturnValue(join(sandbox.path, 'mise'));
        try {
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
        } finally {
            which.mockRestore();
            home.mockRestore();
        }
    },
);

test.skipIf(!isPosix).each(['99.0.0', '1.0.0'])(
    'sandbox tool discovery accepts a newer native version and diagnoses an old one: %s',
    async (version) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            typos: `#!${process.execPath}\nconsole.log('typos ${version}');\n`,
        });
        const executable = join(sandbox.path, 'typos');
        chmodSync(executable, EXECUTABLE_FILE);
        const which = spyOn(executables, 'sync').mockReturnValue(executable);
        try {
            if (version === '99.0.0') {
                expect(buildToolsPath(['typos'])).toStartWith(sandbox.path);
            } else {
                expect(() => buildToolsPath(['typos'])).toThrow('Required tool typos is outdated.');
                expect(() => buildToolsPath(['typos'])).toThrow(`path: ${executable}`);
                expect(() => buildToolsPath(['typos'])).toThrow('found: 1.0.0');
                expect(() => buildToolsPath(['typos'])).toThrow('expected:');
            }
        } finally {
            which.mockRestore();
        }
    },
);

test('library inspection accepts an internal package-directory link and refuses an external target', async () => {
    await using sandbox = await testdir();
    await using outside = await testdir();
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/.store/globals/package.json': '{"name":"globals","version":"17.12.0"}',
    });
    await createFileTree(outside.path, { 'package.json': '{"name":"globals","version":"17.12.0"}' });
    const link = join(sandbox.path, '.gspot/node_modules/globals');
    symlinkSync('.store/globals', link);
    const context = { root: sandbox.path, inspections: new Map() };
    const tool = buildLibraryPin('globals', '17.12.0');
    expect(inspectTool(context, tool)).toMatchObject({ state: 'ok', found: '17.12.0' });
    unlinkSync(link);
    symlinkSync(outside.path, link);
    context.inspections.clear();
    expect(() => inspectTool(context, tool)).toThrow('Source link leaves the repository');
    expect(await Bun.file(join(outside.path, 'package.json')).text()).toBe('{"name":"globals","version":"17.12.0"}');
});
