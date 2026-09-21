import { rejects } from 'node:assert/strict';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { expect, spyOn, test } from 'bun:test';
import { testdir } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { initCommand } from '#cli/lifecycle/init/command.ts';

test('init refuses a failed Git status before writing and succeeds after the failure is corrected', async () => {
    await using directory = await testdir();
    expect(processes.runBlocking(['git', 'init'], { cwd: directory.path }).code).toBe(0);
    const options = {
        cwd: directory.path,
        yes: true,
        isDryRun: false,
        json: true,
        presets: ['none'],
        hooks: 'none',
        runner: 'none',
        ci: 'none',
        rules: 'no',
        install: false,
        allowDirty: false,
    } as const;
    const execute = processes.runBlocking;
    const failed = spyOn(processes, 'runBlocking').mockImplementation((command, settings) =>
        command[1] === 'status'
            ? { code: 128, stdout: '', stderr: 'Cannot read the Git index.', missing: false, duration: 0 }
            : execute(command, settings),
    );
    try {
        await rejects(initCommand({ ...options, presets: [...options.presets] }), {
            message: /Cannot read the Git index/u,
        });
        expect(existsSync(join(directory.path, 'gspot.toml'))).toBe(false);
        expect(existsSync(join(directory.path, '.gspot'))).toBe(false);
    } finally {
        failed.mockRestore();
    }
    const corrected = await initCommand({ ...options, presets: [...options.presets] });
    expect(corrected.exitCode).toBe(0);
    expect(existsSync(join(directory.path, 'gspot.toml'))).toBe(true);
});
