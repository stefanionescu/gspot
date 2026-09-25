import { installCommand } from '#cli/commands/install.ts';
import { uninstallCommand } from '#cli/commands/uninstall.ts';
import { hookLocation } from '#cli/lifecycle/hooks/git.ts';
import * as processes from '#cli/platform/spawn.ts';
import { expect, test } from 'bun:test';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFileTree, testdir } from 'testdirs';

test.each(['before', 'after'] as const)(
    'hook installation recovers interruption %s dispatcher publication',
    async (point) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\nconfigurations = []\n[hooks]\ntool = "gspot"\n[rules]\ninstall = false\n',
        });
        expect((await processes.run(['git', 'init', '-q'], { cwd: sandbox.path })).code).toBe(0);
        const location = hookLocation(sandbox.path);
        const hook = join(location.absolute, 'pre-push');
        const original = '#!/bin/sh\nexit 0\n';
        writeFileSync(hook, original, { mode: 0o751 });
        const boundary = fileURLToPath(
            new URL('../../../../../packages/cli/src/platform/filesystem.ts', import.meta.url),
        );
        const installer = fileURLToPath(
            new URL('../../../../../packages/cli/src/commands/install.ts', import.meta.url),
        );
        const child = `
        import { mock } from 'bun:test';
        const boundary = await import(${JSON.stringify(boundary)});
        const open = boundary.openConfinedRoot;
        mock.module(${JSON.stringify(boundary)}, () => ({ ...boundary, openConfinedRoot(root) {
            const files = open(root);
            return { ...files, write(path, value, expected) {
                if (path === 'hooks/pre-push' && ${JSON.stringify(point)} === 'before') process.exit(73);
                files.write(path, value, expected);
                if (path === 'hooks/pre-push' && ${JSON.stringify(point)} === 'after') process.exit(73);
            } };
        } }));
        const { installCommand } = await import(${JSON.stringify(installer)});
        await installCommand({ cwd: process.cwd(), isDryRun: false });
    `;
        const interrupted = await processes.run([process.execPath, '-e', child], { cwd: sandbox.path });
        expect(interrupted.code, interrupted.stderr).toBe(73);
        const retry = await installCommand({ cwd: sandbox.path, isDryRun: false });
        expect(retry.exitCode, retry.text).toBe(0);
        expect(readFileSync(`${hook}.gspot-original`, 'utf8')).toBe(original);
        const removed = await uninstallCommand({ cwd: sandbox.path, yes: true, isDryRun: false });
        expect(removed.exitCode, removed.text).toBe(0);
        expect(readFileSync(hook, 'utf8')).toBe(original);
        expect(statSync(hook).mode & 0o777).toBe(0o751);
        expect(existsSync(`${hook}.gspot-original`)).toBe(false);
    },
);

test('uninstall recovers after restoring an original hook and before removing its retained sibling', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = []\n[hooks]\ntool = "gspot"\n[rules]\ninstall = false\n',
    });
    expect((await processes.run(['git', 'init', '-q'], { cwd: sandbox.path })).code).toBe(0);
    const location = hookLocation(sandbox.path);
    const hook = join(location.absolute, 'pre-push');
    const original = '#!/bin/sh\nexit 0\n';
    writeFileSync(hook, original, { mode: 0o751 });
    expect((await installCommand({ cwd: sandbox.path, isDryRun: false })).exitCode).toBe(0);
    const boundary = fileURLToPath(new URL('../../../../../packages/cli/src/platform/filesystem.ts', import.meta.url));
    const uninstall = fileURLToPath(new URL('../../../../../packages/cli/src/commands/uninstall.ts', import.meta.url));
    const child = `
        import { mock } from 'bun:test';
        const boundary = await import(${JSON.stringify(boundary)});
        const open = boundary.openConfinedRoot;
        mock.module(${JSON.stringify(boundary)}, () => ({ ...boundary, openConfinedRoot(root) {
            const files = open(root);
            return { ...files, remove(path, expected) {
                if (path === 'hooks/pre-push.gspot-original') process.exit(73);
                files.remove(path, expected);
            } };
        } }));
        const { uninstallCommand } = await import(${JSON.stringify(uninstall)});
        await uninstallCommand({ cwd: process.cwd(), yes: true, isDryRun: false });
    `;
    const interrupted = await processes.run([process.execPath, '-e', child], { cwd: sandbox.path });
    expect(interrupted.code, interrupted.stderr).toBe(73);
    expect(readFileSync(hook, 'utf8')).toBe(original);
    expect(existsSync(`${hook}.gspot-original`)).toBe(true);
    const retry = await uninstallCommand({ cwd: sandbox.path, yes: true, isDryRun: false });
    expect(retry.exitCode, retry.text).toBe(0);
    expect(readFileSync(hook, 'utf8')).toBe(original);
    expect(statSync(hook).mode & 0o777).toBe(0o751);
    expect(existsSync(`${hook}.gspot-original`)).toBe(false);
});
