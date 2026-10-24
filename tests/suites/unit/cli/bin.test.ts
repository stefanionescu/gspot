import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { pathToFileURL } from 'node:url';
import { CLI_BIN } from '#tests/setup/cli/commands.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { runCommand } from '#tests/setup/system/processes.ts';
import { validateRuntimeVersion } from '#cli/system/runtime.ts';

test('an unsupported runtime honors JSON before loading commands', async () => {
    await using sandbox = await testdir();
    const message = validateRuntimeVersion({ node: '0.0.0' }, cliPackage.engines);
    const script = `Object.defineProperty(process, 'versions', { value: { node: '0.0.0' } }); process.argv = ['node', 'gspot', 'check', '--json']; await import(${JSON.stringify(pathToFileURL(CLI_BIN).href)});`;
    const result = await runCommand([process.execPath, '-e', script], { cwd: sandbox.path });
    expect(result.code).toBe(2);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toStrictEqual({ error: 'runtime', message });
});
