import { join } from 'node:path';
import { testdir } from 'testdirs';
import * as clack from '@clack/prompts';
import { commitAll } from '#tests/setup/git.ts';
import { isOnDisk } from '#tests/setup/files.ts';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { test, spyOn, expect, describe } from 'bun:test';
import { simulateInteractiveTerminal } from '#tests/setup/environment.ts';

describe('confirmations', () => {
    test.each([true, false])('returns the answer %s from the terminal', async (answer) => {
        await using sandbox = await testdir({ 'README.md': '# Example\n' });
        commitAll(sandbox.path);
        await using _terminal = await simulateInteractiveTerminal();
        using confirmation = spyOn(clack, 'confirm').mockResolvedValue(answer);
        const result = await runGspot(sandbox.path, ['init']);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        expect(await isOnDisk(join(sandbox.path, 'gspot.toml'))).toBe(answer);
        expect(confirmation).toHaveBeenCalledWith({ message: 'Continue?', initialValue: true });
    });

    test('reports cancellation instead of taking the default', async () => {
        await using sandbox = await testdir({ 'README.md': '# Example\n' });
        commitAll(sandbox.path);
        await using _terminal = await simulateInteractiveTerminal();
        using _confirmation = spyOn(clack, 'confirm').mockResolvedValue(Symbol('cancel'));
        const refused = await runGspot(sandbox.path, ['init']);
        expect(refused.code).toBe(2);
        expect(refused.stderr).toContain('Canceled. Nothing was written.');
        expect(await isOnDisk(join(sandbox.path, 'gspot.toml'))).toBe(false);
    });
});
