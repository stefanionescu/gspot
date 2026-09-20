import { join } from 'node:path';
import { createSandbox } from '@gspot/testing';
import type { ToolPin } from '#types/manifest.ts';
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
            const probe = probeTool(sandbox.path, command('teller', '3.8.1'));
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
        const probe = probeTool(sandbox.path, command('teller', '5.0.1', 'teller'));
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
        const probe = probeTool(sandbox.path, tool);
        expect(probe.found).toBe(native);
        expect(probe.state).toBe(state);
    });

    test('a shim that no configuration gives a version is missing, not broken', async () => {
        await using sandbox = await createSandbox({
            'node_modules/.bin/shimmed':
                "#!/bin/sh\necho 'mise ERROR No version is set for shim: shimmed' >&2\nexit 1\n",
        });
        chmodSync(join(sandbox.path, 'node_modules/.bin/shimmed'), RUNS);
        const probe = probeTool(sandbox.path, command('shimmed', '3.8.1'));
        expect(probe.state).toBe('missing');
        expect(probe.want).toBe('3.8.1');
    });

    test('color codes around a version are no part of it', async () => {
        await using sandbox = await createSandbox({
            'node_modules/.bin/painter': "#!/bin/sh\nprintf 'painter \\033[1;36m26.8.0\\033[0m using more\\n'\n",
        });
        chmodSync(join(sandbox.path, 'node_modules/.bin/painter'), RUNS);
        const probe = probeTool(sandbox.path, command('painter', '26.8.0'));
        expect(probe.found).toBe('26.8.0');
        expect(probe.state).toBe('ok');
    });

    test('a library is found through its package.json, in the root or in a scope', async () => {
        await using sandbox = await createSandbox({
            'node_modules/globals/package.json': '{"name":"globals","version":"17.12.0"}',
            'api/node_modules/eslint-plugin-n/package.json': '{"name":"eslint-plugin-n","version":"18.3.0"}',
        });
        expect(probeTool(sandbox.path, library('globals', '17.12.0')).state).toBe('ok');
        expect(probeTool(sandbox.path, library('eslint-plugin-n', '18.3.0'), ['api']).state).toBe('ok');
    });

    test('a library that is absent is missing, and one off its pin is reported', async () => {
        await using sandbox = await createSandbox({
            'node_modules/typescript/package.json': '{"name":"typescript","version":"6.0.0"}',
        });
        const absent = probeTool(sandbox.path, library('eslint-plugin-regexp', '3.3.0'));
        expect(absent.state).toBe('missing');
        expect(absent.want).toBe('3.3.0');
        const newer = probeTool(sandbox.path, library('typescript', '5.9.3'));
        expect(newer.state).toBe('newer');
        expect(newer.found).toBe('6.0.0');
    });
});
