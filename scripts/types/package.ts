import type { Registry } from '#automation/types/registry.ts';

/** The registry holding the published release, its version, and the npmrc private tool installs read. */
export type PublishedRelease = {
    registry: Pick<Registry, 'url' | 'npmrc' | 'work'>;
    version: string;
};
