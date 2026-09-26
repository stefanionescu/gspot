import { join } from 'node:path';
import { probeTool } from '#cli/tools/probe.ts';
import { createFileTree, testdir } from 'testdirs';
import { runToolCommand } from '#cli/tools/command.ts';
import { describe, expect, spyOn, test } from 'bun:test';
import * as environment from '#cli/platform/environment.ts';
import { commandPin, libraryPin, RUNS } from '#tests/support/cli/pins.ts';
import { chmodSync, existsSync, mkdirSync, symlinkSync, unlinkSync } from 'node:fs';

describe('the tool probe', () => {
    test.skipIf(process.platform === 'win32')(
        'version probes and tool execution prefer helpers from the selected installation',
        async () => {
            await using sandbox = await testdir();
            const launcher = `#!${process.execPath}\nconst child = Bun.spawnSync(['companion'], {stdout:'pipe', stderr:'pipe'}); process.stdout.write(child.stdout); process.exitCode = child.exitCode;\n`;
            await createFileTree(sandbox.path, {
                'node_modules/.bin/teller': launcher,
                'node_modules/.bin/companion': `#!${process.execPath}\nconsole.log('3.8.1');\n`,
                'unrelated/companion': `#!${process.execPath}\nconsole.log('9.0.0');\n`,
            });
            for (const path of ['node_modules/.bin/teller', 'node_modules/.bin/companion', 'unrelated/companion'])
                chmodSync(join(sandbox.path, path), RUNS);
            const env = { PATH: join(sandbox.path, 'unrelated') };
            const tool = { ...commandPin('teller', '3.8.1'), env };
            const observed = probeTool({ root: sandbox.path, probes: new Map() }, tool);
            expect(observed).toMatchObject({ state: 'ok', found: '3.8.1' });
            const executed = await runToolCommand(undefined, [observed.path!], { cwd: sandbox.path, env });
            expect(executed.code).toBe(0);
            expect(executed.stdout.trim()).toBe('3.8.1');
            expect(await Bun.file(join(sandbox.path, 'node_modules/.bin/teller')).text()).toBe(launcher);
        },
    );

    test('an active PATH executable wins over an unrelated mise shim', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'active/teller': '#!/bin/sh\necho 3.8.1\n',
            'mise/shims/teller': '#!/bin/sh\necho 1.0.0\n',
        });
        const active = join(sandbox.path, 'active/teller');
        chmodSync(active, RUNS);
        chmodSync(join(sandbox.path, 'mise/shims/teller'), RUNS);
        const which = spyOn(Bun, 'which').mockReturnValue(active);
        const home = spyOn(environment, 'miseHome').mockReturnValue(join(sandbox.path, 'mise'));
        try {
            const probe = probeTool({ root: sandbox.path, probes: new Map() }, commandPin('teller', '3.8.1'));
            expect(probe.state).toBe('ok');
            expect(probe.path).toBe(active);
        } finally {
            which.mockRestore();
            home.mockRestore();
        }
    });

    test('a managed npm probe refuses a linked manifest before executing and accepts its corrected file', async () => {
        await using sandbox = await testdir();
        await using outside = await testdir();
        await createFileTree(sandbox.path, {
            '.gspot/node_modules/teller/run.sh': '#!/bin/sh\ntouch executed\necho 5.0.1\n',
        });
        await createFileTree(outside.path, { 'package.json': '{"name":"teller","version":"5.0.1"}' });
        const manifest = join(sandbox.path, '.gspot/node_modules/teller/package.json');
        chmodSync(join(sandbox.path, '.gspot/node_modules/teller/run.sh'), RUNS);
        mkdirSync(join(sandbox.path, '.gspot/node_modules/.bin'));
        symlinkSync('../teller/run.sh', join(sandbox.path, '.gspot/node_modules/.bin/teller'));
        symlinkSync(join(outside.path, 'package.json'), manifest);
        const context = { root: sandbox.path, probes: new Map() };
        const tool = commandPin('teller', '5.0.1', 'teller');
        expect(() => probeTool(context, tool)).toThrow('private regular file');
        expect(existsSync(join(sandbox.path, 'executed'))).toBe(false);
        unlinkSync(manifest);
        await Bun.write(manifest, '{"name":"teller","version":"5.0.1"}');
        expect(probeTool(context, tool)).toMatchObject({ state: 'ok', found: '5.0.1' });
        expect(existsSync(join(sandbox.path, 'executed'))).toBe(true);
        expect(await Bun.file(join(outside.path, 'package.json')).text()).toBe('{"name":"teller","version":"5.0.1"}');
    });

    test('an npm tool is the version its package holds, whatever it prints about itself', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            '.gspot/node_modules/teller/package.json': '{"name":"teller","version":"5.0.1"}',
            '.gspot/node_modules/teller/run.sh': '#!/bin/sh\necho 4.4.2\n',
        });
        chmodSync(join(sandbox.path, '.gspot/node_modules/teller/run.sh'), RUNS);
        mkdirSync(join(sandbox.path, '.gspot/node_modules/.bin'));
        symlinkSync('../teller/run.sh', join(sandbox.path, '.gspot/node_modules/.bin/teller'));
        const probe = probeTool({ root: sandbox.path, probes: new Map() }, commandPin('teller', '5.0.1', 'teller'));
        expect(probe.found).toBe('5.0.1');
        expect(probe.state).toBe('ok');
    });

    test.each([
        ['0.9.0', 'ok'],
        ['0.8.0', 'outdated'],
    ] as const)('an independently versioned wrapper runs native %s and reports %s', async (native, state) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            '.gspot/node_modules/wrapper/package.json': '{"name":"wrapper","version":"0.7.0"}',
            '.gspot/node_modules/wrapper/run.sh': '#!/bin/sh\necho "$WRAPPER_NATIVE_VERSION"\n',
        });
        chmodSync(join(sandbox.path, '.gspot/node_modules/wrapper/run.sh'), RUNS);
        mkdirSync(join(sandbox.path, '.gspot/node_modules/.bin'));
        symlinkSync('../wrapper/run.sh', join(sandbox.path, '.gspot/node_modules/.bin/wrapped'));
        const tool = commandPin('wrapped', '0.10.0');
        tool.floor = '0.9.0';
        tool.env = { WRAPPER_NATIVE_VERSION: native };
        tool.installers['npm'] = { name: 'wrapper', version: '0.7.0' };
        const probe = probeTool({ root: sandbox.path, probes: new Map() }, tool);
        expect(probe.found).toBe(native);
        expect(probe.state).toBe(state);
    });

    test('a shim that no configuration gives a version is missing, not broken', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'node_modules/.bin/shimmed':
                "#!/bin/sh\necho 'mise ERROR No version is set for shim: shimmed' >&2\nexit 1\n",
        });
        chmodSync(join(sandbox.path, 'node_modules/.bin/shimmed'), RUNS);
        const probe = probeTool({ root: sandbox.path, probes: new Map() }, commandPin('shimmed', '3.8.1'));
        expect(probe.state).toBe('missing');
        expect(probe.want).toBe('3.8.1');
    });

    test('color codes around a version are no part of it', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'node_modules/.bin/painter': "#!/bin/sh\nprintf 'painter \\033[1;36m26.8.0\\033[0m using more\\n'\n",
        });
        chmodSync(join(sandbox.path, 'node_modules/.bin/painter'), RUNS);
        const probe = probeTool({ root: sandbox.path, probes: new Map() }, commandPin('painter', '26.8.0'));
        expect(probe.found).toBe('26.8.0');
        expect(probe.state).toBe('ok');
    });

    test('a library is found only in its private installation', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            '.gspot/node_modules/globals/package.json': '{"name":"globals","version":"17.12.0"}',
            'api/node_modules/eslint-plugin-n/package.json': '{"name":"eslint-plugin-n","version":"18.3.0"}',
        });
        expect(probeTool({ root: sandbox.path, probes: new Map() }, libraryPin('globals', '17.12.0')).state).toBe('ok');
        expect(
            probeTool({ root: sandbox.path, probes: new Map() }, libraryPin('eslint-plugin-n', '18.3.0')).state,
        ).toBe('missing');
    });

    test('a library that is absent is missing, and one off its pin is reported', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            '.gspot/node_modules/typescript/package.json': '{"name":"typescript","version":"6.0.0"}',
        });
        const absent = probeTool(
            { root: sandbox.path, probes: new Map() },
            libraryPin('eslint-plugin-regexp', '3.3.0'),
        );
        expect(absent.state).toBe('missing');
        expect(absent.want).toBe('3.3.0');
        const newer = probeTool({ root: sandbox.path, probes: new Map() }, libraryPin('typescript', '5.9.3'));
        expect(newer.state).toBe('newer');
        expect(newer.found).toBe('6.0.0');
    });
});
