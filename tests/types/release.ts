// The types of support/release in this package.
import type { SpawnOutcome } from '#tests/types/cli.ts';
import type { Registry } from '#tests/types/registry.ts';
import type { createConsumer } from '#tests/support/release/consumer.ts';

export type PublishedManifest = { version: string; optionalDependencies?: Record<string, string> };
/** The registry holding the published release, its version, and the npmrc private tool installs read. */
export type PublishedRelease = {
    registry: Pick<Registry, 'url' | 'npmrc' | 'work'>;
    version: string;
    toolNpmrc: string;
};
/** A consumer that installed the release, with the command that runs it. */
export type InstalledConsumer = Awaited<ReturnType<typeof createConsumer>>;

/** The native command results produced while preparing an installed consumer. */
export type ConsumerInitialization = { initialized: SpawnOutcome; installedTools: SpawnOutcome };
