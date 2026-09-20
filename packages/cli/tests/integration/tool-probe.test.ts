import { join } from 'node:path';
import { createSandbox } from '@gspot/testing';
import type { ToolPin } from '#types/manifest.ts';
import { openSession } from '#cli/run/session.ts';
import { probeTool } from '#cli/platform/tool-probe.ts';
import { describe, expect, spyOn, test } from 'bun:test';
import * as environment from '#cli/platform/environment.ts';
import { chmodSync, mkdirSync, symlinkSync } from 'node:fs';

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
    test('an active PATH executable wins over an unrelated mise shim', async () => {
        await using sandbox = await createSandbox({
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

    test('an npm tool is the version its package holds, whatever it prints about itself', async () => {
        await using sandbox = await createSandbox({
            'node_modules/teller/package.json': '{"name":"teller","version":"5.0.1"}',
            'node_modules/teller/run.sh': '#!/bin/sh\necho 4.4.2\n',
        });
        chmodSync(join(sandbox.path, 'node_modules/teller/run.sh'), RUNS);
        mkdirSync(join(sandbox.path, 'node_modules/.bin'));
        symlinkSync('../teller/run.sh', join(sandbox.path, 'node_modules/.bin/teller'));
        const probe = probeTool({ root: sandbox.path, probes: new Map() }, command('teller', '5.0.1', 'teller'));
        expect(probe.found).toBe('5.0.1');
        expect(probe.state).toBe('ok');
    });

    test.each([
        ['0.9.0', 'ok'],
        ['0.8.0', 'outdated'],
    ] as const)('an independently versioned wrapper runs native %s and reports %s', async (native, state) => {
        await using sandbox = await createSandbox({
            'node_modules/wrapper/package.json': '{"name":"wrapper","version":"0.7.0"}',
            'node_modules/wrapper/run.sh': '#!/bin/sh\necho "$WRAPPER_NATIVE_VERSION"\n',
        });
        chmodSync(join(sandbox.path, 'node_modules/wrapper/run.sh'), RUNS);
        mkdirSync(join(sandbox.path, 'node_modules/.bin'));
        symlinkSync('../wrapper/run.sh', join(sandbox.path, 'node_modules/.bin/wrapped'));
        const tool = command('wrapped', '0.10.0');
        tool.floor = '0.9.0';
        tool.env = { WRAPPER_NATIVE_VERSION: native };
        tool.installers['npm'] = { name: 'wrapper', version: '0.7.0' };
        const probe = probeTool({ root: sandbox.path, probes: new Map() }, tool);
        expect(probe.found).toBe(native);
        expect(probe.state).toBe(state);
    });

    test('a shim that no configuration gives a version is missing, not broken', async () => {
        await using sandbox = await createSandbox({
            'node_modules/.bin/shimmed':
                "#!/bin/sh\necho 'mise ERROR No version is set for shim: shimmed' >&2\nexit 1\n",
        });
        chmodSync(join(sandbox.path, 'node_modules/.bin/shimmed'), RUNS);
        const probe = probeTool({ root: sandbox.path, probes: new Map() }, command('shimmed', '3.8.1'));
        expect(probe.state).toBe('missing');
        expect(probe.want).toBe('3.8.1');
    });

    test('color codes around a version are no part of it', async () => {
        await using sandbox = await createSandbox({
            'node_modules/.bin/painter': "#!/bin/sh\nprintf 'painter \\033[1;36m26.8.0\\033[0m using more\\n'\n",
        });
        chmodSync(join(sandbox.path, 'node_modules/.bin/painter'), RUNS);
        const probe = probeTool({ root: sandbox.path, probes: new Map() }, command('painter', '26.8.0'));
        expect(probe.found).toBe('26.8.0');
        expect(probe.state).toBe('ok');
    });

    test('a library is found through its package.json, in the root or in a scope', async () => {
        await using sandbox = await createSandbox({
            'node_modules/globals/package.json': '{"name":"globals","version":"17.12.0"}',
            'api/node_modules/eslint-plugin-n/package.json': '{"name":"eslint-plugin-n","version":"18.3.0"}',
        });
        expect(probeTool({ root: sandbox.path, probes: new Map() }, library('globals', '17.12.0')).state).toBe('ok');
        expect(
            probeTool({ root: sandbox.path, probes: new Map() }, library('eslint-plugin-n', '18.3.0'), ['api']).state,
        ).toBe('ok');
    });

    test('a library that is absent is missing, and one off its pin is reported', async () => {
        await using sandbox = await createSandbox({
            'node_modules/typescript/package.json': '{"name":"typescript","version":"6.0.0"}',
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
    await using sandbox = await createSandbox({});
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
    await using sandbox = await createSandbox({
        'node_modules/teller/package.json': '{"name":"teller","version":"5.0.1"}',
        'node_modules/teller/run.sh': '#!/bin/sh\necho 5.0.1\nexit 7\n',
    });
    chmodSync(join(sandbox.path, 'node_modules/teller/run.sh'), RUNS);
    mkdirSync(join(sandbox.path, 'node_modules/.bin'));
    symlinkSync('../teller/run.sh', join(sandbox.path, 'node_modules/.bin/teller'));
    const probe = probeTool({ root: sandbox.path, probes: new Map() }, command('teller', '5.0.1', 'teller'));
    expect(probe.state).toBe('error');
    expect(probe.note).toContain('exited 7');
});

test('a version printed before a genuine timeout does not make a tool usable', async () => {
    await using sandbox = await createSandbox({});
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
    await using sandbox = await createSandbox({});
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

test('tool observations distinguish pins and library search scopes', async () => {
    await using sandbox = await createSandbox({
        'gspot.toml': 'version = 1\npresets = []\n',
        'api/node_modules/example/package.json': '{"name":"example","version":"1.0.0"}',
    });
    const session = await openSession(sandbox.path);
    const pin = library('example', '1.0.0');
    expect(probeTool(session, pin).state).toBe('missing');
    expect(probeTool(session, pin, ['api']).state).toBe('ok');
    expect(probeTool(session, library('example', '2.0.0'), ['api']).state).toBe('outdated');
});

test('a command shares version observations and the next session probes again', async () => {
    await using sandbox = await createSandbox({
        'gspot.toml': 'version = 1\npresets = []\n',
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
