type WorkflowStep = {
    name?: string;
    id?: string;
    run?: string;
    uses?: string;
    if?: string;
    env?: Record<string, string>;
    with?: Record<string, string>;
};

export type GithubWorkflow = {
    name: string;
    permissions: Record<string, string>;
    jobs: Record<string, { name?: string; if?: string; 'runs-on': string; steps: WorkflowStep[] }>;
};

export type GitlabPipeline = { gspot: { script: string[] } };

export type CiDocument = GithubWorkflow | GitlabPipeline;
