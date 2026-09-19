// Types of the swift checks.

/** The build of one Swift scope. */
export type SwiftBuildPlan = {
    /** The folder the build runs in. */
    cwd: string;
    /** The cache folder of this scope. */
    folder: string;
    /** Where the compiler log is written. */
    log: string;
    argv: string[];
};
