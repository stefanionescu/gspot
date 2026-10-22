import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { GITATTRIBUTES_FILE } from '#cli/config/files/names.ts';
import { GITHUB_WORKFLOW, GITLAB_WORKFLOW } from '#cli/config/generation/ci.ts';

export const COLUMN_GAP = 2;

export const CONFIGURATION_WIDTH = 16;

export const ORIGIN_WIDTH = 12;

/** The shared attributes row in every initialization plan. */
export const ATTRIBUTES_ROW = {
    path: GITATTRIBUTES_FILE,
    note: 'marks the generated files and keeps LF line endings',
} as const;

/** The plan row of the hooks folder. */
export const HOOKS_ROW = {
    path: GSPOT_PATHS.hooks,
    note: 'gspot install points core.hooksPath here; a repository that already runs hooks gets the lines to add instead',
} as const;

/** The note of each generated CI file in the init plan. */
export const CI_FILE_NOTES = {
    [GITHUB_WORKFLOW]: 'check workflow',
    [GITLAB_WORKFLOW]: `add include: [{ local: ${GITLAB_WORKFLOW} }] to .gitlab-ci.yml`,
} as const;

export const DETECTION_LABEL_WIDTH = 20;

export const DETECTION_GAP_WIDTH = 3;
