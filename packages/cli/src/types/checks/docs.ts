/** The task names that mise, package scripts, and installed binaries offer in one project. */
export type TaskNames = { mise: Set<string>; scripts: Set<string>; binaries: Set<string> };

/** Repository paths and per-project task definitions used by documentation validation. */
export type PathIndex = {
    known: Set<string>;
    isIgnored: (path: string) => boolean;
    tasks: TaskNames;
};
