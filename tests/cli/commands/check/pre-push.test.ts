import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { runGspot } from '#tests/harness/gspot.ts';
import { PUSH_CONTENT } from '#tests/config/samples/git.ts';
import type { CommandFailureJson } from '#cli/types/terminal.ts';
import { PUSH_CHECK_COMMAND } from '#tests/config/samples/pre-push.ts';
import { gitOutput, preparePushRepository } from '#tests/harness/git.ts';

test.each(['local', 'remote'] as const)(
    'missing %s objects fail selection without touching the working tree',
    async (side) => {
        await using sandbox = await testdir();
        const { base, reviewed, broken } = await preparePushRepository(sandbox.path);
        const missing = await runGspot(
            sandbox.path,
            PUSH_CHECK_COMMAND,
            {},
            {
                stdin: `refs/heads/reviewed ${side === 'local' ? 'f'.repeat(base.length) : reviewed} refs/heads/main ${side === 'remote' ? 'f'.repeat(base.length) : base}\n`,
            },
        );
        expect(missing.code, missing.stdout + missing.stderr).toBe(2);
        expect((JSON.parse(missing.stdout) as CommandFailureJson).error).toBe('selection');
        expect(gitOutput(sandbox.path, ['rev-parse', 'HEAD'])).toBe(broken);
        expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(PUSH_CONTENT.policy);
        expect(await readFile(join(sandbox.path, 'changed.sh'), 'utf8')).toBe(PUSH_CONTENT.working);
    },
);
