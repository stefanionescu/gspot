// Planted repository: uninstall removes what init wrote, the package.json entries and the lefthook commands included.
import { join } from 'node:path';
import { createFixture } from 'fs-fixture';
import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { commitAll, PLANTED_TIMEOUT_MS, run, script, toolsPath } from '#tests/harness/planted.ts';

describe('uninstall', () => {
    test(
        'removes the generated files, its package.json entries and its lefthook commands, and keeps the rest',
        async () => {
            await using fixture = await createFixture({
                'scripts/a.sh': script,
                'package.json':
                    '{"name":"planted","private":true,"scripts":{"build":"true"},"devDependencies":{"left-pad":"1.3.0"}}\n',
                'lefthook.yml': 'pre-commit:\n    commands:\n        mine:\n            run: echo mine\n',
            });
            commitAll(fixture.path);
            const environment = { PATH: toolsPath(['ast-grep', 'shellcheck', 'shfmt']) };
            await run(
                fixture.path,
                [
                    'init',
                    '--yes',
                    '--presets',
                    'bash',
                    '--runner',
                    'bun',
                    '--hooks',
                    'lefthook',
                    '--ci',
                    'none',
                    '--no-rules',
                    '--no-install',
                ],
                environment,
            );
            const installed = JSON.parse(readFileSync(join(fixture.path, 'package.json'), 'utf8')) as {
                scripts: Record<string, string>;
            };
            expect(installed.scripts['check']).toBe('gspot check');
            expect(readFileSync(join(fixture.path, 'lefthook.yml'), 'utf8')).toContain('gspot');
            const removed = await run(fixture.path, ['uninstall', '--yes'], environment);
            expect(removed.code).toBe(0);
            const manifest = JSON.parse(readFileSync(join(fixture.path, 'package.json'), 'utf8')) as {
                scripts: Record<string, string>;
                devDependencies: Record<string, string>;
            };
            expect(manifest.scripts).toEqual({ build: 'true' });
            expect(manifest.devDependencies).toEqual({ 'left-pad': '1.3.0' });
            const lefthook = readFileSync(join(fixture.path, 'lefthook.yml'), 'utf8');
            expect(lefthook).toContain('mine');
            expect(lefthook).not.toContain('gspot');
            expect(existsSync(join(fixture.path, '.gspot'))).toBe(false);
            expect(existsSync(join(fixture.path, 'gspot.toml'))).toBe(true);
        },
        PLANTED_TIMEOUT_MS,
    );
});
