import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { runGspot } from '#tests/setup/run-gspot.ts';
import * as processes from '#cli/system/processes.ts';
import { matchSubstring } from '#tests/setup/matchers.ts';
import { isOnDisk, readTree } from '#tests/setup/files.ts';
import { buildProcessResult } from '#tests/setup/builders.ts';

test('an unexpected error during install reaches the failure handler and changes nothing', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `configurations = ["markdown"]
[rules]
enabled = false
`,
        'README.md': '# Example\n',
    });
    const applied = await runGspot(sandbox.path, ['apply', '--json']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const settings = await readFile(join(sandbox.path, 'gspot.toml'));
    const before = await readTree(sandbox.path);
    using resources = new DisposableStack();
    resources.use(
        spyOn(processes, 'spawnProcess').mockImplementation((command) => {
            if (command[0] !== 'npm') return Promise.resolve(buildProcessResult());
            return Promise.reject(new Error('Unexpected process failure.'));
        }),
    );
    const human = await runGspot(sandbox.path, ['install']);
    expect(human.code, human.stdout + human.stderr).toBe(2);
    expect(human.stdout).toBe('');
    expect(human.stderr).toContain('Unexpected process failure.');
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    const failed = await runGspot(sandbox.path, ['install', '--json']);
    expect(failed.code).toBe(2);
    expect(failed.stderr).toBe('');
    expect(JSON.parse(failed.stdout)).toMatchObject({
        error: 'failure',
        message: matchSubstring('Unexpected process failure.'),
    });
    expect(await readFile(join(sandbox.path, 'gspot.toml'))).toStrictEqual(settings);
    expect(await isOnDisk(join(sandbox.path, '.gspot/node_modules'))).toBe(false);
    expect(await isOnDisk(join(sandbox.path, '.gspot/package-lock.json'))).toBe(false);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});
