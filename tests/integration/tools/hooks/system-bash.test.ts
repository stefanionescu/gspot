import { join } from 'node:path';
import { chmodSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { toolsPath } from '#tests/support/cli/tools.ts';
import { git, commitAll } from '#tests/support/cli/git.ts';
import { hookBody, hookCommand } from '#cli/generation/hooks/scripts.ts';
import { SYSTEM_BASH } from '#tests/constants/integration/tools/hooks.ts';

if (process.platform !== 'win32')
    test('every hook body runs under the system Bash', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'README.md': '# Hook test\n' });
        commitAll(sandbox.path);
        const remote = 'https://example.com/planted.git';
        expect(git(sandbox.path, ['remote', 'add', 'origin', remote]).code).toBe(0);
        const argumentsByHook = {
            'pre-commit': [],
            'pre-push': ['origin', remote],
            'commit-msg': ['message-file'],
        };
        for (const name of ['pre-commit', 'pre-push', 'commit-msg'] as const) {
            const path = join(sandbox.path, name);
            await Bun.write(path, hookBody(name, false, [hookCommand(name, 'none', '/bin/echo')]));
            chmodSync(path, 0o755);
            const result = Bun.spawnSync([SYSTEM_BASH, path, ...argumentsByHook[name]], {
                cwd: sandbox.path,
                env: { PATH: toolsPath([]) },
                stdin: 'ignore',
                stdout: 'pipe',
                stderr: 'pipe',
            });
            expect(result.stderr.toString()).toBe('');
            expect(result.exitCode).toBe(0);
            expect(result.stdout.toString()).toContain('check');
        }
    });
