// The types of support/release in this package.
import type { createConsumer } from '#tests/support/release/consumer.ts';
import type { startRegistry } from '#tests/support/registry/lifecycle.ts';

export type PublishedManifest = { version: string; optionalDependencies?: Record<string, string> };
/** The registry holding the published release, its version, and the npmrc private tool installs read. */
export type PublishedRelease = {
    registry: Awaited<ReturnType<typeof startRegistry>>;
    version: string;
    toolNpmrc: string;
};
/** A consumer that installed the release, with the command that runs it. */
export type InstalledConsumer = Awaited<ReturnType<typeof createConsumer>>;
