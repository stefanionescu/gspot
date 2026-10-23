import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { UNSET_REFUSALS } from '#tests/config/commands/unset.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

test.each([...UNSET_REFUSALS])(
    'unset $commandArguments exits 2 and leaves gspot.toml as it was',
    async ({ commandArguments, message }) => {
        await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings([]) });
        const path = join(sandbox.path, 'gspot.toml');
        const before = await readFile(path, 'utf8');
        const result = await runGspot(sandbox.path, commandArguments);
        expect(result.code).toBe(2);
        expect(result.stderr).toBe(`${message}\n`);
        expect(await readFile(path, 'utf8')).toBe(before);
    },
);
