import { test, expect } from 'bun:test';
import { join, delimiter } from 'node:path';
import { chmodSync, readdirSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import { root } from '#tests/support/release/packages.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import { waitForFile, captureChild } from '#tests/support/cli/process.ts';

test.each(['refusal', 'SIGINT', 'SIGTERM'] as const)(
    'release acceptance removes its registry after publication %s',
    async (scenario) => {
        await using sandbox = await testdir();
        const marker = join(sandbox.path, 'started');
        await createFileTree(sandbox.path, {
            temp: {},
            'bin/npm':
                '#!/usr/bin/env bun\nconsole.error("Publication fixture started.");\n' +
                `await Bun.write(${JSON.stringify(marker)}, 'ready');\n` +
                (scenario === 'refusal' ? 'process.exit(9);\n' : 'await Bun.sleep(60_000);\n'),
        });
        chmodSync(join(sandbox.path, 'bin/npm'), 0o755);
        const child = Bun.spawn([process.execPath, join(root, 'tests/support/release/run.ts')], {
            cwd: join(root, 'tests'),
            env: {
                ...environmentVariables(),
                PATH: [join(sandbox.path, 'bin'), environmentVariables()['PATH']].join(delimiter),
                TMPDIR: join(sandbox.path, 'temp'),
            },
            stdout: 'pipe',
            stderr: 'pipe',
            timeout: 15_000,
            killSignal: 'SIGKILL',
        });
        await using capture = captureChild(child);
        expect(await waitForFile(marker)).toBe(true);
        if (scenario !== 'refusal') child.kill(scenario);
        const expected = { refusal: 1, SIGINT: 130, SIGTERM: 143 }[scenario];
        expect(await child.exited, await capture.errors).toBe(expected);
        expect(await capture.errors).toContain('Publication fixture started.');
        expect(readdirSync(join(sandbox.path, 'temp'))).toStrictEqual([]);
    },
    30_000,
);
