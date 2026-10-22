import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';

export const TOOL_PROJECT_FILES: ReadonlySet<string> = new Set([
    GSPOT_PATHS.miseProject,
    GSPOT_PATHS.npmProject,
    GSPOT_PATHS.pythonProject,
    GSPOT_PATHS.yarnSettings,
]);
