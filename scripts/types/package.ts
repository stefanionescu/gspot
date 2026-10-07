/** The registry holding the packed release, its version, and the npmrc private tool installs read. */
export type PublishedRelease = {
    registry: { url: string; npmrc: string; work: string };
    version: string;
};
