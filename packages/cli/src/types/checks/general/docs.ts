/** The task names that mise, package scripts, and installed binaries offer in one project. */
export type TaskNames = { mise: Set<string>; scripts: Set<string>; binaries: Set<string> };

/** The tracked paths and task names that documented paths and commands must match. */
export type PathIndex = {
    paths: Set<string>;
    isIgnored: (path: string) => boolean;
    tasks: TaskNames;
};
