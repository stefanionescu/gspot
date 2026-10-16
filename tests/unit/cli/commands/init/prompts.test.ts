import { join } from 'node:path';
import { testdir } from 'testdirs';
import * as clack from '@clack/prompts';
import { commitAll } from '#tests/setup/git.ts';
import { isOnDisk } from '#tests/setup/files.ts';
import { test, spyOn, expect, describe } from 'bun:test';
import { captureRejection } from '#tests/setup/matchers.ts';
import { runRegisteredCommand } from '#tests/setup/run-gspot.ts';
import { simulateInteractiveTerminal } from '#tests/setup/environment.ts';

describe('confirmations', () => {
    test.each([true, false])('returns the answer %s from the terminal', async (answer) => {
        using _output = spyOn(process.stdout, 'write').mockReturnValue(true);

        await using sandbox = await testdir({ 'README.md': '# Example\n' });
        commitAll(sandbox.path);
        await using _terminal = await simulateInteractiveTerminal();
        using confirmation = spyOn(clack, 'confirm').mockResolvedValue(answer);
        const result = await runRegisteredCommand(sandbox.path, ['init']);
        expect(result.exitCode, result.text).toBe(0);
        expect(await isOnDisk(join(sandbox.path, 'gspot.toml'))).toBe(answer);
        expect(confirmation).toHaveBeenCalledWith({ message: 'Continue?', initialValue: true });
    });

    test('reports cancellation instead of taking the default', async () => {
        using _output = spyOn(process.stdout, 'write').mockReturnValue(true);

        await using sandbox = await testdir({ 'README.md': '# Example\n' });
        commitAll(sandbox.path);
        await using _terminal = await simulateInteractiveTerminal();
        using _confirmation = spyOn(clack, 'confirm').mockResolvedValue(Symbol('cancel'));
        expect(await captureRejection(runRegisteredCommand(sandbox.path, ['init']))).toContain(
            'Canceled. Nothing was written.',
        );
        expect(await isOnDisk(join(sandbox.path, 'gspot.toml'))).toBe(false);
    });
});
