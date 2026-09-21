import * as versions from 'latest-version';
import { createFileTree, testdir } from 'testdirs';
import { doctorCommand } from '#cli/doctor/command.ts';
import { describe, expect, spyOn, test } from 'bun:test';

describe('doctor', () => {
    test('local diagnostics do not request registry metadata', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\npresets = []\n',
            'README.md': '# Example\n',
        });
        const lookup = spyOn(versions, 'default').mockRejectedValue(new Error('Registry access is unavailable.'));
        try {
            const result = await doctorCommand({ cwd: sandbox.path });
            expect(result.exitCode).toBe(0);
            expect(result.json).toMatchObject({ version: { running: expect.any(String) } });
            expect(result.text).toContain('README.md');
            expect(lookup).not.toHaveBeenCalled();
        } finally {
            lookup.mockRestore();
        }
    });
});
