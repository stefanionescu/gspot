import { join } from 'node:path';
import { createSandbox } from '@gspot/testing';
import { test, expect, describe } from 'bun:test';
import { npmPins } from '#cli/emit/runner-tasks.ts';
import { run as runProcess } from '#cli/platform/spawn.ts';
import { presetManifests } from '#cli/presets/read-manifests.ts';
import { isReleaseTestWanted } from '#cli/platform/environment.ts';
import { commitAll, install, run, PLANTED_TIMEOUT_MS } from '#tests/harness/planted.ts';

describe.skipIf(!isReleaseTestWanted())('npm binary wrappers', () => {
    test(
        'installed pins report syntax and formatting defects and accept corrected files',
        async () => {
            const manifests = presetManifests().values().toArray();
            const entries = Object.entries(npmPins(manifests));
            const dependencies = Object.fromEntries(
                entries.filter(([name]) => ['@taplo/cli', 'editorconfig-checker'].includes(name)),
            );
            await using sandbox = await createSandbox({
                'package.json': `${JSON.stringify({ name: 'wrapper-probe', private: true, dependencies })}\n`,
                'settings.toml': 'a    =    1\n',
                'notes.json': '"text"   ',
            });
            const added = await runProcess([process.execPath, 'install', '--ignore-scripts'], {
                cwd: sandbox.path,
                timeoutMs: PLANTED_TIMEOUT_MS,
            });
            expect(added.code, added.stdout + added.stderr).toBe(0);
            commitAll(sandbox.path);
            await install(sandbox.path, [
                'init',
                '--yes',
                '--presets',
                'config-files',
                '--no-runner',
                '--no-ci',
                '--no-hooks',
                '--no-rules',
                '--no-install',
            ]);
            const format = ['check', '--only', 'config-files/toml-format', '--no-cache'];
            const unformatted = await run(sandbox.path, format);
            expect(unformatted.code, unformatted.stdout + unformatted.stderr).toBe(1);
            expect(unformatted.stdout).toContain('settings.toml');
            const fixed = await run(sandbox.path, [...format, '--fix']);
            expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
            expect(await Bun.file(join(sandbox.path, 'settings.toml')).text()).toBe('a = 1\n');
            await Bun.write(join(sandbox.path, 'settings.toml'), 'a = [\n');
            const invalid = await run(sandbox.path, ['check', '--only', 'config-files/toml', '--no-cache']);
            expect(invalid.code, invalid.stdout + invalid.stderr).toBe(1);
            expect(invalid.stdout).toContain('settings.toml');
            await Bun.write(join(sandbox.path, 'settings.toml'), 'a = 1\n');
            const valid = await run(sandbox.path, ['check', '--only', 'config-files/toml', '--no-cache']);
            expect(valid.code, valid.stdout + valid.stderr).toBe(0);
            const whitespace = ['check', '--only', 'formatting/editorconfig-checker', '--no-cache'];
            const trailing = await run(sandbox.path, whitespace);
            expect(trailing.code, trailing.stdout + trailing.stderr).toBe(1);
            expect(trailing.stdout).toContain('notes.json');
            await Bun.write(join(sandbox.path, 'notes.json'), '"text"\n');
            const clean = await run(sandbox.path, whitespace);
            expect(clean.code, clean.stdout + clean.stderr).toBe(0);
        },
        PLANTED_TIMEOUT_MS,
    );
});
