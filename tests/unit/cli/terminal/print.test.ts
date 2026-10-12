import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { NO_COLOR_SETTINGS } from '#tests/config/terminal.ts';

test('NO_COLOR prints findings without ANSI escape codes on terminal streams', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': NO_COLOR_SETTINGS });
    using resources = new DisposableStack();
    for (const stream of [process.stdout, process.stderr]) {
        const original = Object.getOwnPropertyDescriptor(stream, 'isTTY');
        resources.defer(() => {
            if (original === undefined) Reflect.deleteProperty(stream, 'isTTY');
            else Object.defineProperty(stream, 'isTTY', original);
        });
        Object.defineProperty(stream, 'isTTY', { value: true, configurable: true });
    }
    const result = await runGspot(sandbox.path, ['check', '--only', 'gspot/unused-entries'], {
        NO_COLOR: '1',
        CI: '',
    });
    expect(result.code, result.stdout + result.stderr).toBe(1);
    expect(result.stdout).toContain('absent/** under [[ignore]] matches no tracked file or folder.');
    expect(result.stdout).toContain('gspot/unused-entries');
    expect(result.stdout + result.stderr).not.toContain('\u001B[');
});
