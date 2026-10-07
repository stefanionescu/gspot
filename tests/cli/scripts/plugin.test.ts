import { test, expect } from 'bun:test';
import { join, delimiter } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import { isPosix } from '#tests/config/harness/platforms.ts';
import { prepareTestCommand } from '#tests/harness/command.ts';
import { workspaceRoot as root } from '#automation/workspace.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import { rmSync, chmodSync, existsSync, readFileSync } from 'node:fs';
import type { PackageArchiveMarker } from '#tests/types/harness/process.ts';
import { STALLED_PACKAGE_PACKING } from '#tests/config/cli/scripts/plugin.ts';
import { waitForExit, waitForFile, captureChild } from '#tests/harness/process.ts';

test.skipIf(!isPosix).each([
    ['SIGINT', 130],
    ['SIGTERM', 143],
] as const)(
    'canceling workspace package packing with %s returns its signal status and removes its process and archives',
    async (signal, code) => {
        await using directory = await testdir();
        const marker = join(directory.path, 'packing.json');
        const native = join(directory.path, 'npm');
        await createFileTree(directory.path, { npm: STALLED_PACKAGE_PACKING });
        chmodSync(native, 0o755);
        const command = [process.execPath, join(root, 'scripts/plugin.ts'), '--help'];
        const prepared = prepareTestCommand(
            command,
            {
                cwd: root,
                env: {
                    ...environmentVariables(),
                    GSPOT_PACKAGE_MARKER: marker,
                    PATH: `${directory.path}${delimiter}${environmentVariables()['PATH'] ?? ''}`,
                },
                timeoutMs: 30_000,
            },
            'workspace packing cancellation',
        );
        const child = Bun.spawn(command, {
            cwd: prepared.options.cwd,
            ...(prepared.options.env === undefined ? {} : { env: prepared.options.env }),
            timeout: prepared.options.timeoutMs,
            stdout: 'pipe',
            stderr: 'pipe',
            killSignal: 'SIGKILL',
        });
        await using capture = captureChild(child);
        let owned: PackageArchiveMarker | undefined;
        try {
            expect(await waitForFile(marker)).toBe(true);
            owned = JSON.parse(readFileSync(marker, 'utf8')) as PackageArchiveMarker;
            child.kill(signal);
            expect(await child.exited, `${prepared.context}\n${await capture.errors}`).toBe(code);
            expect(await capture.errors).not.toContain('Package packing failed');
            expect(existsSync(owned.work)).toBe(false);
        } finally {
            if (child.exitCode === null) child.kill('SIGTERM');
            await child.exited;
            if (owned !== undefined) {
                await waitForExit(owned.pid);
                rmSync(owned.work, { recursive: true, force: true });
            }
        }
    },
);
