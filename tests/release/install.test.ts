// Installs the published launcher with --ignore-scripts and runs gspot --version from the install.
// Runs when GSPOT_RELEASE_TEST=1 (CI sets it); it needs a built binary under dist/ and a free port.
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { existsSync, writeFileSync } from 'node:fs';
import { publishTo, startRegistry } from '#tests/harness/registry/lifecycle.ts';
import { environmentVariables, isReleaseTestWanted } from '#cli/platform/environment.ts';

describe.skipIf(!isReleaseTestWanted())('the npm launcher', () => {
    test('installs with --ignore-scripts and runs the binary of this platform', async () => {
        const registry = await startRegistry();
        try {
            expect(publishTo(registry)).toBe(0);
            const { work } = registry;
            writeFileSync(join(work, 'package.json'), '{"name":"probe","private":true}\n');
            const added = Bun.spawnSync(
                [
                    'npm',
                    'install',
                    'gspot@0.1.0',
                    '--ignore-scripts',
                    '--registry',
                    registry.url,
                    '--no-audit',
                    '--no-fund',
                ],
                {
                    cwd: work,
                    env: { ...environmentVariables(), NPM_CONFIG_USERCONFIG: registry.npmrc },
                    stdout: 'pipe',
                    stderr: 'pipe',
                },
            );
            expect(added.exitCode).toBe(0);
            expect(existsSync(join(work, 'node_modules', 'gspot', 'gspot.js'))).toBe(true);
            const version = Bun.spawnSync(['npx', '--no-install', 'gspot', '--version'], {
                cwd: work,
                stdout: 'pipe',
                stderr: 'pipe',
            });
            expect(version.stdout.toString().trim()).toBe('0.1.0');
        } finally {
            await registry.stop();
        }
    });
});
