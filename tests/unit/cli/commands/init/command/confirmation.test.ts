import { join } from 'node:path';
import { testdir } from 'testdirs';
import * as clack from '@clack/prompts';
import { commitAll } from '#tests/setup/git.ts';
import { pathExists } from '#tests/setup/files.ts';
import { rejection } from '#tests/setup/matchers.ts';
import { buildInitOptions } from '#tests/setup/init.ts';
import { test, spyOn, expect, describe } from 'bun:test';
import * as environment from '#cli/system/environment.ts';
import { initCommand } from '#cli/commands/init/command.ts';

describe('confirmations', () => {
    test.each([true, false])('returns the answer %s from the terminal', async (answer) => {
        using mockResources = new DisposableStack();
        await using sandbox = await testdir({ 'README.md': '# Example\n' });
        commitAll(sandbox.path);
        mockResources.use(spyOn(environment, 'isInteractive').mockReturnValue(true));
        using confirmation = spyOn(clack, 'confirm').mockResolvedValue(answer);
        const result = await initCommand(buildInitOptions(sandbox.path, { yes: false }));
        expect(result.exitCode, result.text).toBe(0);
        expect(await pathExists(join(sandbox.path, 'gspot.toml'))).toBe(answer);
        expect(confirmation).toHaveBeenCalledWith({ message: 'Continue?', initialValue: true });
    });

    test('reports cancellation instead of taking the default', async () => {
        using mockResources = new DisposableStack();
        await using sandbox = await testdir({ 'README.md': '# Example\n' });
        commitAll(sandbox.path);
        mockResources.use(spyOn(environment, 'isInteractive').mockReturnValue(true));
        mockResources.use(spyOn(clack, 'confirm').mockResolvedValue(Symbol('cancel')));
        expect(await rejection(initCommand(buildInitOptions(sandbox.path, { yes: false })))).toContain(
            'Canceled. Nothing was written.',
        );
        expect(await pathExists(join(sandbox.path, 'gspot.toml'))).toBe(false);
    });
});
