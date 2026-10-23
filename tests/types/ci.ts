type WorkflowStep = {
    name?: string;
    run?: string;
    uses?: string;
    if?: string;
    env?: Record<string, string>;
    with?: Record<string, string>;
};

export type GithubWorkflow = {
    name: string;
    permissions: Record<string, string>;
    jobs: Record<string, { steps: WorkflowStep[] }>;
};

export type GitlabPipeline = { gspot: { script: string[] } };

export type CiDocument = GithubWorkflow | GitlabPipeline;
