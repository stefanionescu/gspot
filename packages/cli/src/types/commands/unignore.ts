/** Matching ignore removals and the records that remain after removing individual paths. */
export type IgnoreRemoval = {
    kept: unknown[];
    deleted: number;
    changedIgnores: number;
    removedPaths: number;
    everywhere: number;
};
