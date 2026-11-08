import type { GithubWorkflow, GitlabPipeline, PythonProject, ToolProjectFiles } from '#tests/types/setup.ts';

export type CiDocument = GithubWorkflow | GitlabPipeline;

export type IndexedPythonProject = PythonProject & { files: ToolProjectFiles };

export type LinkFailure = { scope: string; file: string; rule: string };

export type GitleaksHistory = { base: string; leaked: string; removed: string };

export type LinterJsonFinding = {
    code?: string;
    rule_id?: string;
    line?: number;
    location?: { row: number };
};
