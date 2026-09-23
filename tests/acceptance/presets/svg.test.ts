import { run as runProcess } from '#cli/platform/spawn.ts';
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';
import { install } from '#tests/support/cli/tools.ts';
import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';

test(
    'native SVG byte savings use the selected level and exact file inputs',
    async () => {
        await using sandbox = await testdir();
        const root = sandbox.path;
        await createFileTree(root, {
            'icon.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><path d="M0 0h8v8H0z"/></svg>\n',
        });
        await install(root, [
            'init',
            '--yes',
            '--presets',
            'static-site',
            '--without',
            'spelling',
            'naming',
            '--no-runner',
            '--no-ci',
            '--no-hooks',
            '--no-rules',
            '--no-install',
        ]);
        const native = await runProcess(
            [join(root, '.gspot/node_modules/.bin/svgo'), '--input', 'icon.svg', '--output', '-'],
            { cwd: root },
        );
        expect(native.code, native.stdout + native.stderr).toBe(0);
        const command = ['check', '--only', 'static-site/svg-optimized', '--no-cache', '--json'];
        await Bun.write(join(root, 'icon.svg'), `${native.stdout} `);
        const small = await run(root, command);
        expect(small.code, small.stdout + small.stderr).toBe(0);
        await Bun.write(join(root, 'icon.svg'), native.stdout + ' '.repeat(Buffer.byteLength(native.stdout)));
        const large = await run(root, command);
        expect(large.code, large.stdout + large.stderr).toBe(1);
        expect(JSON.parse(large.stdout).checks[0].findings).toEqual([
            expect.objectContaining({ file: 'icon.svg', rule: 'svg' }),
        ]);
        await Bun.write(join(root, 'icon.svg'), `${native.stdout} `);
        const configured = await run(root, ['set', 'level', 'all']);
        expect(configured.code, configured.stdout + configured.stderr).toBe(0);
        const strict = await run(root, command);
        expect(strict.code, strict.stdout + strict.stderr).toBe(1);
        await Bun.write(join(root, 'icon.svg'), native.stdout);
        const corrected = await run(root, command);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        await Bun.write(join(root, 'other.svg'), '<svg><broken>');
        const selected = await run(root, [...command, 'icon.svg']);
        expect(selected.code, selected.stdout + selected.stderr).toBe(0);
        const malformed = await run(root, command);
        expect(malformed.code, malformed.stdout + malformed.stderr).toBe(2);
        expect(JSON.parse(malformed.stdout).checks[0].status).toBe('error');
    },
    PLANTED_TIMEOUT_MS * 3,
);
