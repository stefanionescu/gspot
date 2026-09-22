import { createFileTree, testdir } from 'testdirs';
import { doctorCommand } from '#cli/doctor/command.ts';
import { expect, test } from 'bun:test';

test('doctor reports local configuration and version', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': 'version = 1\npresets = []\n', 'README.md': '# Example\n' });
    const result = await doctorCommand({ cwd: sandbox.path });
    expect(result.exitCode).toBe(0);
    expect(result.json).toMatchObject({ version: { running: expect.any(String) } });
});
