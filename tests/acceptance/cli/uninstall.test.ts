// Planted repository: uninstall removes what init wrote, the package.json entries and the lefthook commands included.
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';
import { commitAll } from '#tests/support/cli/git.ts';
import { script } from '#tests/support/cli/planted.ts';
import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';

describe('uninstall', () => {
    test(
        'removes the generated files, its package.json entries and its lefthook commands, and keeps the rest',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'scripts/a.sh': script,
                'package.json':
                    '{"name":"planted","private":true,"scripts":{"build":"true"},"devDependencies":{"left-pad":"1.3.0"}}\n',
                'lefthook.yml': 'pre-commit:\n    commands:\n        mine:\n            run: echo mine\n',
            });
            commitAll(sandbox.path);
            await run(sandbox.path, [
                'init',
                '--yes',
                '--configurations',
                'bash',
                '--runner',
                'bun',
                '--hooks',
                'lefthook',
                '--no-ci',
                '--no-rules',
                '--no-install',
            ]);
            const installed = JSON.parse(readFileSync(join(sandbox.path, 'package.json'), 'utf8')) as {
                scripts: Record<string, string>;
            };
            expect(installed.scripts['gspot:check']).toBe('gspot check');
            expect(readFileSync(join(sandbox.path, 'lefthook.yml'), 'utf8')).toContain('gspot');
            const removed = await run(sandbox.path, ['uninstall', '--yes', '--json']);
            expect(removed.code).toBe(0);
            expect((JSON.parse(removed.stdout) as { applied: boolean }).applied).toBe(true);
            const manifest = JSON.parse(readFileSync(join(sandbox.path, 'package.json'), 'utf8')) as {
                scripts: Record<string, string>;
                devDependencies: Record<string, string>;
            };
            expect(manifest.scripts).toEqual({ build: 'true' });
            expect(manifest.devDependencies).toEqual({ 'left-pad': '1.3.0' });
            const lefthook = readFileSync(join(sandbox.path, 'lefthook.yml'), 'utf8');
            expect(lefthook).toContain('mine');
            expect(lefthook).not.toContain('gspot');
            expect(existsSync(join(sandbox.path, '.gspot/state/recovery'))).toBe(true);
            expect(readFileSync(join(sandbox.path, '.gitignore'), 'utf8')).toContain('.gspot/state/');
            expect(existsSync(join(sandbox.path, '.gspot/config/shellcheckrc'))).toBe(false);
            expect(existsSync(join(sandbox.path, 'gspot.toml'))).toBe(true);
        },
        PLANTED_TIMEOUT_MS,
    );
});
