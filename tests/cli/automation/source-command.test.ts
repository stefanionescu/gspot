import { test, expect } from 'bun:test';
import { join, delimiter } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import { isPosix } from '#tests/config/harness/platforms.ts';
import { prepareTestCommand } from '#tests/harness/command.ts';
import { workspaceRoot as root } from '#automation/workspace.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import { rmSync, chmodSync, existsSync, readFileSync } from 'node:fs';
import type { RegistryStartupMarker } from '#tests/types/harness/process.ts';
import { STALLED_REGISTRY } from '#tests/config/cli/automation/source-command.ts';
import { waitForExit, waitForFile, captureChild } from '#tests/harness/process.ts';

test.skipIf(!isPosix)(
    'canceling source-command registry startup returns SIGTERM status and removes its owned process and storage',
    async () => {
        await using directory = await testdir();
        const marker = join(directory.path, 'registry.json');
        const native = join(directory.path, 'node');
        await createFileTree(directory.path, { node: STALLED_REGISTRY });
        chmodSync(native, 0o755);
        const command = [process.execPath, join(root, 'scripts/plugin.ts'), '--help'];
        const prepared = prepareTestCommand(
            command,
            {
                cwd: root,
                env: {
                    ...environmentVariables(),
                    GSPOT_REGISTRY_MARKER: marker,
                    PATH: `${directory.path}${delimiter}${environmentVariables()['PATH'] ?? ''}`,
                },
                timeoutMs: 30_000,
            },
            'source registry startup cancellation',
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
        let owned: RegistryStartupMarker | undefined;
        try {
            expect(await waitForFile(marker)).toBe(true);
            owned = JSON.parse(readFileSync(marker, 'utf8')) as RegistryStartupMarker;
            child.kill('SIGTERM');
            expect(await child.exited, `${prepared.context}\n${await capture.errors}`).toBe(143);
            expect(await capture.errors).not.toContain('Registry startup failed');
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
