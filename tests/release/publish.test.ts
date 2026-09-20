// Publishes the launcher and the platform packages to a local verdaccio and reads them back.
// Runs when GSPOT_RELEASE_TEST=1 (CI sets it); it needs a built binary under dist/ and a free port.
import { describe, expect, test } from 'bun:test';
import { isReleaseTestWanted } from '#cli/platform/environment.ts';
import { publishTo, startRegistry } from '#tests/harness/registry/lifecycle.ts';

describe.skipIf(!isReleaseTestWanted())('the release publish', () => {
    test('puts the launcher and this platform package into the registry at one version', async () => {
        const registry = await startRegistry();
        try {
            expect(publishTo(registry)).toBe(0);
            const response = await fetch(`${registry.url}/gspot`);
            const launcher = (await response.json()) as {
                versions: Record<string, { optionalDependencies: Record<string, string> }>;
            };
            const published = launcher.versions['0.1.0'];
            expect(published).toBeDefined();
            const name = `@gspot/cli-${process.platform}-${process.arch}`;
            expect(published?.optionalDependencies[name]).toBe('0.1.0');
            const platformPackage = await fetch(`${registry.url}/${name.replace('/', '%2f')}`);
            expect(platformPackage.ok).toBe(true);
        } finally {
            await registry.stop();
        }
    });
});
