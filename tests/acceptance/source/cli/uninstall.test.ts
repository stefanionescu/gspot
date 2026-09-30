// Planted repository: uninstall removes what init wrote, the package.json entries and the hook scripts included.
import { join } from 'node:path';
import { test, expect, describe } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { commitAll } from '#tests/support/cli/git.ts';
import { script } from '#tests/support/cli/planted.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/inputs/cli.ts';

describe('uninstall', () => {
    test(
        'removes the generated files, its package.json entries and its hook scripts, and keeps the rest',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'scripts/a.sh': script,
                'package.json':
                    '{"name":"planted","private":true,"scripts":{"build":"true"},"devDependencies":{"left-pad":"1.3.0"}}\n',
            });
            commitAll(sandbox.path);
            await run(sandbox.path, [
                'init',
                '--yes',
                '--kits',
                'bash',
                '--runner',
                'bun',
                '--no-ci',
                '--no-guides',
                '--no-install',
            ]);
            const installed = JSON.parse(readFileSync(join(sandbox.path, 'package.json'), 'utf8')) as {
                scripts: Record<string, string>;
            };
            expect(installed.scripts).toStrictEqual({ build: 'true' });
            expect(existsSync(join(sandbox.path, '.gspot/hooks/pre-commit'))).toBe(true);
            const removed = await run(sandbox.path, ['uninstall', '--yes', '--json']);
            expect(removed.code).toBe(0);
            expect((JSON.parse(removed.stdout) as { applied: boolean }).applied).toBe(true);
            const manifest = JSON.parse(readFileSync(join(sandbox.path, 'package.json'), 'utf8')) as {
                scripts: Record<string, string>;
                devDependencies: Record<string, string>;
            };
            expect(manifest.scripts).toStrictEqual({ build: 'true' });
            expect(manifest.devDependencies).toStrictEqual({ 'left-pad': '1.3.0' });
            expect(existsSync(join(sandbox.path, '.gspot/hooks/pre-commit'))).toBe(false);
            expect(existsSync(join(sandbox.path, '.gspot/state/recovery'))).toBe(true);
            expect(readFileSync(join(sandbox.path, '.gitignore'), 'utf8')).toContain('.gspot/state/');
            expect(existsSync(join(sandbox.path, '.gspot/config/shellcheckrc'))).toBe(false);
            expect(existsSync(join(sandbox.path, 'gspot.toml'))).toBe(true);
        },
        PLANTED_TIMEOUT_MS,
    );
});
