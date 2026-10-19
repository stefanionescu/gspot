/** The task names that mise, package scripts, and installed binaries offer in one project. */
export type TaskNames = { mise: Set<string>; packages: Set<string>; binaries: Set<string> };

/** Repository paths and per-project task definitions used by documentation validation. */
export type PathIndex = {
    known: Set<string>;
    /** Whether a tracked .gitignore ignores the path, or a folder that holds it. */
    isIgnored: (path: string) => boolean;
    tasks: TaskNames;
};
