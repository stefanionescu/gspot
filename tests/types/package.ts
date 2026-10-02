// The types of the package harness: the published release and its consumers.
import type { SpawnOutcome } from '#tests/types/cli.ts';
import type { Registry } from '#tests/types/registry.ts';
import type { createConsumer } from '#tests/harness/package/consumer.ts';

/** The registry holding the published release, its version, and the npmrc private tool installs read. */
export type PublishedRelease = {
    registry: Pick<Registry, 'url' | 'npmrc' | 'work'>;
    version: string;
    toolNpmrc: string;
};
/** A consumer that installed the release, with the command that runs it. */
export type InstalledConsumer = Awaited<ReturnType<typeof createConsumer>>;

/** A fresh consumer of the release: its install, its folder, the command that runs gspot, and the options it runs with. */
export type CreateConsumerResult = {
    installed: SpawnOutcome;
    consumer: string;
    command: string[];
    options: {
        cwd: string;
        env: Record<string, string | undefined>;
        timeoutMs: number;
    };
    setupOptions: { env: Record<string, string>; cwd: string; timeoutMs: number };
    workspace: string;
    [Symbol.asyncDispose]: () => Promise<void>;
};
