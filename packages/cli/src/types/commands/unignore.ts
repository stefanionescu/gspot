/**
 * What unignore changes: the records that remain, and how many ignores it deleted or changed, how many paths it
 * removed, and how many ignores that cover every path it kept.
 */
export type IgnoreRemoval = {
    kept: unknown[];
    deleted: number;
    changedIgnores: number;
    removedPaths: number;
    everywhere: number;
};
