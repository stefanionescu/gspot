import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { stringify } from '@decimalturn/toml-patch';
import { CLI_BIN } from '#tests/setup/cli/commands.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { buildSpawnEnvironment } from '#cli/system/environment.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { waitForFile, startCommand } from '#tests/setup/system/processes.ts';
import { SLOW_COMMAND_CHECK } from '#tests/config/commands/check/cancellation.ts';

test.skipIf(isWindows).each(['SIGINT', 'SIGTERM'] as const)(
    'a canceled text report prints the %s process exit code',
    async (signal) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings([], { tables: stringify({ command_check: [SLOW_COMMAND_CHECK] }) }),
            'source.txt': 'input\n',
        });
        commitAll(sandbox.path);
        await using capture = startCommand([process.execPath, CLI_BIN, 'check', '--only', 'project/slow'], {
            cwd: sandbox.path,
            env: { ...buildSpawnEnvironment(), NO_COLOR: '1', CI: '1' },
        });
        expect(await waitForFile(join(sandbox.path, 'started.pid'))).toBe(true);
        capture.child.kill(signal);
        const code = signal === 'SIGINT' ? 130 : 143;
        expect(await capture.child.exited).toBe(code);
        expect(await capture.output).toContain(`Exit code ${String(code)}.`);
    },
);
