/** The registry holding the packed release, its version, and the npmrc tool installations read. */
export type PublishedRelease = {
    registry: { url: string; npmrc: string; work: string };
    version: string;
};
