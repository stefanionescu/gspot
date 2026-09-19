import { join } from 'node:path';
import { createFixture } from 'fs-fixture';
import type { ToolPin } from '#types/manifest.ts';
import { describe, expect, test } from 'bun:test';
import { probeTool } from '#cli/platform/tool-probe.ts';
import { chmodSync, mkdirSync, symlinkSync } from 'node:fs';

function library(name: string, version: string): ToolPin {
    return { name, kind: 'library', version, windows: true, installers: { npm: name } };
}

const RUNS = 0o755;

function command(name: string, version: string, npm?: string): ToolPin {
    return { name, kind: 'binary', version, windows: true, installers: npm === undefined ? {} : { npm } };
}

describe('the tool probe', () => {
    test('an npm tool is the version its package holds, whatever it prints about itself', async () => {
        await using fixture = await createFixture({
            'node_modules/teller/package.json': '{"name":"teller","version":"5.0.1"}',
            'node_modules/teller/run.sh': '#!/bin/sh\necho 4.4.2\n',
        });
        chmodSync(join(fixture.path, 'node_modules/teller/run.sh'), RUNS);
        mkdirSync(join(fixture.path, 'node_modules/.bin'));
        symlinkSync('../teller/run.sh', join(fixture.path, 'node_modules/.bin/teller'));
        const probe = probeTool(fixture.path, command('teller', '5.0.1', 'teller'));
        expect(probe.found).toBe('5.0.1');
        expect(probe.state).toBe('ok');
    });

    test('a shim that no configuration gives a version is missing, not broken', async () => {
        await using fixture = await createFixture({
            'node_modules/.bin/shimmed':
                "#!/bin/sh\necho 'mise ERROR No version is set for shim: shimmed' >&2\nexit 1\n",
        });
        chmodSync(join(fixture.path, 'node_modules/.bin/shimmed'), RUNS);
        const probe = probeTool(fixture.path, command('shimmed', '3.8.1'));
        expect(probe.state).toBe('missing');
        expect(probe.want).toBe('3.8.1');
    });

    test('color codes around a version are no part of it', async () => {
        await using fixture = await createFixture({
            'node_modules/.bin/painter': "#!/bin/sh\nprintf 'painter \\033[1;36m26.8.0\\033[0m using more\\n'\n",
        });
        chmodSync(join(fixture.path, 'node_modules/.bin/painter'), RUNS);
        const probe = probeTool(fixture.path, command('painter', '26.8.0'));
        expect(probe.found).toBe('26.8.0');
        expect(probe.state).toBe('ok');
    });

    test('a library is found through its package.json, in the root or in a scope', async () => {
        await using fixture = await createFixture({
            'node_modules/globals/package.json': '{"name":"globals","version":"17.12.0"}',
            'api/node_modules/eslint-plugin-n/package.json': '{"name":"eslint-plugin-n","version":"18.3.0"}',
        });
        expect(probeTool(fixture.path, library('globals', '17.12.0')).state).toBe('ok');
        expect(probeTool(fixture.path, library('eslint-plugin-n', '18.3.0'), ['api']).state).toBe('ok');
    });

    test('a library that is absent is missing, and one off its pin is reported', async () => {
        await using fixture = await createFixture({
            'node_modules/typescript/package.json': '{"name":"typescript","version":"6.0.0"}',
        });
        const absent = probeTool(fixture.path, library('eslint-plugin-regexp', '3.3.0'));
        expect(absent.state).toBe('missing');
        expect(absent.want).toBe('3.3.0');
        const newer = probeTool(fixture.path, library('typescript', '5.9.3'));
        expect(newer.state).toBe('newer');
        expect(newer.found).toBe('6.0.0');
    });
});
