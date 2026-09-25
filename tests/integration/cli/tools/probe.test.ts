import type { ToolPin } from '#cli/configurations/manifests.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { openSession } from '#cli/execution/session.ts';
import * as environment from '#cli/platform/environment.ts';
import { runToolCommand } from '#cli/tools/command.ts';
import { privateToolInstallation } from '#cli/tools/pins.ts';
import { locateTool, probeTool } from '#cli/tools/probe.ts';
import { describe, expect, spyOn, test } from 'bun:test';
import { chmodSync, existsSync, mkdirSync, symlinkSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';

function library(name: string, version: string): ToolPin {
    return { name, kind: 'library', version, windows: true, installers: { npm: { name, version } } };
}

const RUNS = 0o755;

function command(name: string, version: string, npm?: string): ToolPin {
    return {
        name,
        kind: 'binary',
        version,
        windows: true,
        installers: npm === undefined ? {} : { npm: { name: npm, version } },
    };
}

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
            const tool = { ...command('teller', '3.8.1'), env };
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
            const probe = probeTool({ root: sandbox.path, probes: new Map() }, command('teller', '3.8.1'));
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
        const tool = command('teller', '5.0.1', 'teller');
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
        const probe = probeTool({ root: sandbox.path, probes: new Map() }, command('teller', '5.0.1', 'teller'));
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
        const tool = command('wrapped', '0.10.0');
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
        const probe = probeTool({ root: sandbox.path, probes: new Map() }, command('shimmed', '3.8.1'));
        expect(probe.state).toBe('missing');
        expect(probe.want).toBe('3.8.1');
    });

    test('color codes around a version are no part of it', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'node_modules/.bin/painter': "#!/bin/sh\nprintf 'painter \\033[1;36m26.8.0\\033[0m using more\\n'\n",
        });
        chmodSync(join(sandbox.path, 'node_modules/.bin/painter'), RUNS);
        const probe = probeTool({ root: sandbox.path, probes: new Map() }, command('painter', '26.8.0'));
        expect(probe.found).toBe('26.8.0');
        expect(probe.state).toBe('ok');
    });

    test('a library is found only in its private installation', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            '.gspot/node_modules/globals/package.json': '{"name":"globals","version":"17.12.0"}',
            'api/node_modules/eslint-plugin-n/package.json': '{"name":"eslint-plugin-n","version":"18.3.0"}',
        });
        expect(probeTool({ root: sandbox.path, probes: new Map() }, library('globals', '17.12.0')).state).toBe('ok');
        expect(probeTool({ root: sandbox.path, probes: new Map() }, library('eslint-plugin-n', '18.3.0')).state).toBe(
            'missing',
        );
    });

    test('a library that is absent is missing, and one off its pin is reported', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            '.gspot/node_modules/typescript/package.json': '{"name":"typescript","version":"6.0.0"}',
        });
        const absent = probeTool({ root: sandbox.path, probes: new Map() }, library('eslint-plugin-regexp', '3.3.0'));
        expect(absent.state).toBe('missing');
        expect(absent.want).toBe('3.3.0');
        const newer = probeTool({ root: sandbox.path, probes: new Map() }, library('typescript', '5.9.3'));
        expect(newer.state).toBe('newer');
        expect(newer.found).toBe('6.0.0');
    });
});

test.each([
    ['console.log("3.8.1"); process.exitCode = 7;', 'error', 'exited 7'],
    ['console.log("unrecognized output");', 'error', 'valid version'],
    ['console.error("3.8.1");', 'ok', undefined],
] as const)('a version process classifies %s as %s', async (script, state, note) => {
    await using sandbox = await testdir();
    const which = spyOn(Bun, 'which').mockReturnValue(process.execPath);
    try {
        const tool = { ...command('version-teller', '3.8.1'), version_command: ['-e', script] };
        const probe = probeTool({ root: sandbox.path, probes: new Map() }, tool);
        expect(probe.state).toBe(state);
        if (note === undefined) {
            expect(probe.found).toBe('3.8.1');
        } else {
            expect(probe.note).toContain(note);
        }
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
    chmodSync(join(sandbox.path, '.gspot/node_modules/teller/run.sh'), RUNS);
    mkdirSync(join(sandbox.path, '.gspot/node_modules/.bin'));
    symlinkSync('../teller/run.sh', join(sandbox.path, '.gspot/node_modules/.bin/teller'));
    const probe = probeTool({ root: sandbox.path, probes: new Map() }, command('teller', '5.0.1', 'teller'));
    expect(probe.state).toBe('error');
    expect(probe.note).toContain('exited 7');
});

test('a version printed before a genuine timeout does not make a tool usable', async () => {
    await using sandbox = await testdir();
    const which = spyOn(Bun, 'which').mockReturnValue(process.execPath);
    try {
        const tool = {
            ...command('version-teller', '3.8.1'),
            version_command: ['-e', 'console.log("3.8.1 No version is set for shim"); setInterval(() => {}, 1000);'],
        };
        const probe = probeTool({ root: sandbox.path, probes: new Map() }, tool);
        expect(probe.state).toBe('error');
        expect(probe.note).toContain('timed out');
    } finally {
        which.mockRestore();
    }
}, 20_000);

test('a manifest can declare its help command status without accepting other failed probes', async () => {
    await using sandbox = await testdir();
    const which = spyOn(Bun, 'which').mockReturnValue(process.execPath);
    try {
        const tool = {
            ...command('version-help', '3.8.1'),
            version_command: ['-e', 'console.log("version-help 3.8.1"); process.exitCode = 2;'],
            version_exit_code: 2,
        };
        const context = { root: sandbox.path, probes: new Map() };
        const probe = probeTool(context, tool);
        expect(probe.state).toBe('ok');
        expect(probe.found).toBe('3.8.1');
        const failed = probeTool(context, { ...tool, version_exit_code: 0 });
        expect(failed.state).toBe('error');
        expect(failed.note).toContain('exited 2');
    } finally {
        which.mockRestore();
    }
});

test('tool observations distinguish pins and refresh private libraries in the next session', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = []\n',
        'api/node_modules/example/package.json': '{"name":"example","version":"1.0.0"}',
    });
    const session = await openSession(sandbox.path);
    const pin = library('example', '1.0.0');
    expect(probeTool(session, pin).state).toBe('missing');
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/example/package.json': '{"name":"example","version":"1.0.0"}',
    });
    expect(probeTool(session, pin).state).toBe('missing');
    const next = await openSession(sandbox.path);
    expect(probeTool(next, pin).state).toBe('ok');
    expect(probeTool(next, library('example', '2.0.0')).state).toBe('outdated');
});

test('a command shares version observations and the next session probes again', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = []\n',
        'probe.ts':
            'const file = Bun.file("calls.txt"); const calls = await file.exists() ? Number(await file.text()) : 0; await Bun.write("calls.txt", String(calls + 1)); console.log("3.8.1");',
    });
    const which = spyOn(Bun, 'which').mockReturnValue(process.execPath);
    try {
        const pin = { ...command('version-teller', '3.8.1'), version_command: ['probe.ts'] };
        const session = await openSession(sandbox.path);
        expect(probeTool(session, pin).state).toBe('ok');
        expect(probeTool(session, pin).state).toBe('ok');
        expect(await Bun.file(join(sandbox.path, 'calls.txt')).text()).toBe('1');
        const next = await openSession(sandbox.path);
        expect(probeTool(next, pin).state).toBe('ok');
        expect(await Bun.file(join(sandbox.path, 'calls.txt')).text()).toBe('2');
    } finally {
        which.mockRestore();
    }
});

test.each([
    ['wrapper', 'ok'],
    ['other-package', 'error'],
] as const)('the declared npm version exit applies only to the matching package: %s', async (packageName, state) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/wrapper/package.json': JSON.stringify({ name: packageName, version: '0.7.0' }),
        '.gspot/node_modules/wrapper/run.sh': '#!/bin/sh\necho 0.9.0\nexit 1\n',
    });
    chmodSync(join(sandbox.path, '.gspot/node_modules/wrapper/run.sh'), RUNS);
    mkdirSync(join(sandbox.path, '.gspot/node_modules/.bin'));
    symlinkSync('../wrapper/run.sh', join(sandbox.path, '.gspot/node_modules/.bin/wrapped'));
    const tool = command('wrapped', '0.10.0');
    tool.floor = '0.9.0';
    tool.installers['npm'] = { name: 'wrapper', version: '0.7.0', version_exit_code: 1 };
    const observed = probeTool({ root: sandbox.path, probes: new Map() }, tool);
    expect(observed.state).toBe(state);
    if (state === 'ok') expect(observed.found).toBe('0.9.0');
    else expect(observed.note).toContain('version probe exited 1');
});

test('managed executable discovery refuses an external link before probing and accepts an internal replacement', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'project/.gspot/node_modules/.bin/.keep': '',
        'project/.gspot/node_modules/teller/run.sh': '#!/bin/sh\necho 1.2.3\n',
        'outside/teller': `#!/bin/sh\ntouch '${join(directory.path, 'outside/executed')}'\necho 1.2.3\n`,
    });
    const root = join(directory.path, 'project');
    const binary = join(root, '.gspot/node_modules/.bin/teller');
    chmodSync(join(directory.path, 'outside/teller'), RUNS);
    chmodSync(join(root, '.gspot/node_modules/teller/run.sh'), RUNS);
    symlinkSync('../../../../outside/teller', binary);
    expect(() => probeTool({ root, probes: new Map() }, command('teller', '1.2.3'))).toThrow(
        'Source link leaves the repository',
    );
    expect(existsSync(join(directory.path, 'outside/executed'))).toBe(false);
    unlinkSync(binary);
    symlinkSync('../teller/run.sh', binary);
    expect(probeTool({ root, probes: new Map() }, command('teller', '1.2.3')).state).toBe('ok');
});

test('managed library discovery refuses a linked package directory', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'project/.gspot/node_modules/.keep': '',
        'outside/package.json': '{"name":"external-library","version":"1.2.3"}',
    });
    const root = join(directory.path, 'project');
    symlinkSync('../../../outside', join(root, '.gspot/node_modules/external-library'));
    expect(() => probeTool({ root, probes: new Map() }, library('external-library', '1.2.3'))).toThrow(
        'Unsafe lifecycle parent',
    );
});

test.each([
    ['javascript', 'eslint', undefined, 'npm'],
    ['javascript', 'eslint', 'mise', 'npm'],
    ['structure', 'ast-grep', 'mise', undefined],
    ['structure', 'ast-grep', 'npm', 'npm'],
    ['python', 'ruff', undefined, 'python'],
    ['python', 'ruff', 'mise', 'python'],
    ['typescript', 'tsc', undefined, undefined],
] as const)('installation placement for %s/%s under %s is %s', (configuration, name, runner, kind) => {
    const tool = configurationManifests()
        .get(configuration)!
        .tools.find((entry) => entry.name === name)!;
    expect(tool).toBeDefined();
    const placement = privateToolInstallation(tool, runner);
    expect(placement?.kind).toBe(kind);
    if (placement !== undefined)
        expect(tool.installers[placement.kind === 'python' ? 'pypi' : 'npm']?.version).toBe(placement.version);
});

test('a missing private npm binary cannot fall back to the developer executable', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'node_modules/teller/package.json': '{"name":"teller","version":"5.0.1"}',
        'node_modules/teller/run.sh': '#!/bin/sh\ntouch fallback-ran\necho 5.0.1\n',
    });
    chmodSync(join(sandbox.path, 'node_modules/teller/run.sh'), RUNS);
    mkdirSync(join(sandbox.path, 'node_modules/.bin'));
    symlinkSync('../teller/run.sh', join(sandbox.path, 'node_modules/.bin/teller'));
    const tool = command('teller', '5.0.1', 'teller');
    const missing = probeTool({ root: sandbox.path, probes: new Map() }, tool);
    expect(missing.state).toBe('missing');
    expect(missing.path).toBeUndefined();
    expect(existsSync(join(sandbox.path, 'fallback-ran'))).toBe(false);
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/teller/package.json': '{"name":"teller","version":"5.0.1"}',
        '.gspot/node_modules/teller/run.sh': '#!/bin/sh\necho 5.0.1\n',
    });
    chmodSync(join(sandbox.path, '.gspot/node_modules/teller/run.sh'), RUNS);
    mkdirSync(join(sandbox.path, '.gspot/node_modules/.bin'));
    symlinkSync('../teller/run.sh', join(sandbox.path, '.gspot/node_modules/.bin/teller'));
    expect(probeTool({ root: sandbox.path, probes: new Map() }, tool)).toMatchObject({ state: 'ok', found: '5.0.1' });
    expect(existsSync(join(sandbox.path, 'fallback-ran'))).toBe(false);
});

test('direct host lookup excludes an unrelated managed compiler', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/.bin/tsc': '#!/bin/sh\nexit 7\n',
        'node_modules/.bin/tsc': '#!/bin/sh\necho 5.9.3\n',
    });
    expect(locateTool(sandbox.path, 'tsc')).toBe(join(sandbox.path, 'node_modules/.bin/tsc'));
});

test('a private Python pin refuses a project executable and uses its own environment', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        '.venv/bin/teller': '#!/bin/sh\ntouch fallback-ran\necho 1.2.3\n',
    });
    chmodSync(join(sandbox.path, '.venv/bin/teller'), RUNS);
    const tool = command('teller', '1.2.3');
    tool.installers['pypi'] = { name: 'teller', version: '1.2.3' };
    expect(probeTool({ root: sandbox.path, probes: new Map() }, tool).state).toBe('missing');
    await createFileTree(sandbox.path, {
        '.gspot/.venv/bin/teller': '#!/bin/sh\necho 1.2.3\n',
    });
    chmodSync(join(sandbox.path, '.gspot/.venv/bin/teller'), RUNS);
    expect(probeTool({ root: sandbox.path, probes: new Map() }, tool)).toMatchObject({ state: 'ok', found: '1.2.3' });
    expect(existsSync(join(sandbox.path, 'fallback-ran'))).toBe(false);
});
