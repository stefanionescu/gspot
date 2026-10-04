/** A generated GitHub workflow step inspected or executed by provider tests. */
export type WorkflowStep = { run?: string; uses?: string; if?: string; with?: Record<string, string> };
/** A generated GitHub workflow with named jobs and their steps. */
export type GithubWorkflow = {
    name: string;
    permissions: Record<string, string>;
    jobs: Record<string, { steps: WorkflowStep[] }>;
};
/** The generated GitLab job whose script is executed in provider tests. */
export type GitlabPipeline = { gspot: { script: string[] } };
/** One generated provider document, with its provider-specific keys. */
export type CiDocument = GithubWorkflow | GitlabPipeline;
