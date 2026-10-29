import { GITHUB_WORKFLOW, GITLAB_WORKFLOW } from '#cli/config/generation/ci.ts';

export const VERSION_GAP = 4;

export const TOOL_STATE_COLORS = {
    ok: 'green',
    error: 'red',
    missing: 'red',
    outdated: 'red',
    newer: 'red',
    system: 'dim',
} as const;

export const COLUMN_WIDTHS = { label: 9, name: 34, note: 30 } as const;

export const SUGGESTION_SECTIONS = [
    { key: 'detected', title: 'detected, not selected' },
    { key: 'suggested', title: 'suggested, not selected' },
    { key: 'undetected', title: 'selected, but no files yet' },
    { key: 'unowned', title: 'config files gspot does not own' },
    { key: 'lintJobs', title: 'existing lint jobs' },
] as const;

export const LEVEL_COMMAND = 'gspot set level all';

export const LINT_JOB_NOTE = 'an existing lint job';

export const GIT_INIT_COMMAND = 'git init';

export const CI_FILE_LABELS = {
    github: GITHUB_WORKFLOW,
    gitlab: `${GITLAB_WORKFLOW} (include from .gitlab-ci.yml)`,
} as const;

export const ORIGIN_URL_SETTING = 'remote.origin.url';

export const REMOTE_URL_SCHEME = /^(?:https?|ssh):\/\//u;

export const REMOTE_URL_USER = /^[^@/]+@/u;

export const CI_OFF_NOTES = {
    github: 'off; gspot set ci.enabled true writes the check workflow',
    gitlab: 'off; gspot set ci.enabled true and gspot set ci.provider gitlab write the check workflow',
} as const;

export const ENVIRONMENT_MISSING_NOTE = 'The project environment is missing. Run uv sync in its folder.';
