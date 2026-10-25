import { GITHUB_WORKFLOW, GITLAB_WORKFLOW } from '#cli/config/generation/ci.ts';

export const CI_FILE_LABELS = {
    github: GITHUB_WORKFLOW,
    gitlab: `${GITLAB_WORKFLOW} (include from .gitlab-ci.yml)`,
} as const;
