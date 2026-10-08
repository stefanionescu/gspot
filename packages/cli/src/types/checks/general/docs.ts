/** The distinct task definitions each runner consumes in one project. */
export type TaskSources = { mise: Set<string>; packages: Set<string> };

/** Repository paths and per-project task definitions used by documentation validation. */
export type PathIndex = {
    known: Set<string>;
    tasks: TaskSources;
};
