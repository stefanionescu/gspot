import { fileURLToPath } from 'node:url';
import { basename, join } from 'node:path';
import { run } from '#cli/platform/spawn.ts';
import { cpSync, symlinkSync } from 'node:fs';
import { test, expect, describe } from 'bun:test';
import { PLANTED_TIMEOUT_MS } from '#tests/harness/planted.ts';
import { presetManifests } from '#cli/presets/read-manifests.ts';
import { isReleaseTestWanted } from '#cli/platform/environment.ts';
import { startRegistry } from '#tests/harness/registry/lifecycle.ts';

const plugin = { name: '@gspot/eslint-plugin' };
const root = fileURLToPath(new URL('../..', import.meta.url));

describe.skipIf(!isReleaseTestWanted())('the ESLint plugin package', () => {
    test(
        'the manifest pin is published from an isolated build to the owned registry',
        async () => {
            const registry = await startRegistry();
            try {
                const source = join(registry.work, 'plugin');
                cpSync(join(root, 'packages/eslint-plugin'), source, {
                    recursive: true,
                    filter: (path) => !['node_modules', 'dist'].includes(basename(path)),
                });
                symlinkSync(join(root, 'node_modules'), join(registry.work, 'node_modules'), 'junction');
                const built = await run([process.execPath, 'build.ts'], { cwd: source, timeoutMs: PLANTED_TIMEOUT_MS });
                expect(built.code, built.stdout + built.stderr).toBe(0);
                registry.assertRunning();
                const published = await run(
                    [
                        'npm',
                        'publish',
                        source,
                        '--ignore-scripts',
                        '--registry',
                        registry.url,
                        '--userconfig',
                        registry.npmrc,
                    ],
                    {
                        cwd: registry.work,
                        timeoutMs: PLANTED_TIMEOUT_MS,
                    },
                );
                expect(published.code, published.stdout + published.stderr).toBe(0);
                const manifests = presetManifests().values().toArray();
                const pin = manifests
                    .flatMap((manifest) => manifest.tools)
                    .find((tool) => tool.installers['npm']?.name === plugin.name)?.installers['npm'];
                if (pin?.version === undefined) throw new Error('The plugin has no npm version pin.');
                const response = await fetch(`${registry.url}/${encodeURIComponent(plugin.name)}/${pin.version}`, {
                    signal: AbortSignal.timeout(15_000),
                });
                expect(response.ok).toBe(true);
                const metadata = (await response.json()) as { version: string; dist: { tarball: string } };
                expect(metadata.version).toBe(pin.version);
                expect(new URL(metadata.dist.tarball).origin).toBe(registry.url);
            } finally {
                await registry.stop();
            }
        },
        PLANTED_TIMEOUT_MS,
    );
});
