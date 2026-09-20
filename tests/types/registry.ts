/** A local npm registry the release tests publish into. */
export type Registry = {
    url: string;
    npmrc: string;
    work: string;
    assertRunning: () => void;
    stop: () => Promise<void>;
};
