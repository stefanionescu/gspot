/** A generated GitHub workflow step that the CI tests read and run. */
type WorkflowStep = {
    name?: string;
    run?: string;
    uses?: string;
    if?: string;
    env?: Record<string, string>;
    with?: Record<string, string>;
};

/** A generated GitHub workflow with named jobs and their steps. */
export type GithubWorkflow = {
    name: string;
    permissions: Record<string, string>;
    jobs: Record<string, { steps: WorkflowStep[] }>;
};

/** The generated GitLab job that the CI tests run. */
export type GitlabPipeline = { gspot: { script: string[] } };

/** A generated CI file of either provider. */
export type CiDocument = GithubWorkflow | GitlabPipeline;
