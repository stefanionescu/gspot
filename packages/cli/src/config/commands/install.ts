import {
    YARN_SETTINGS,
    NPM_TOOL_PROJECT_FILE,
    MISE_TOOL_PROJECT_FILE,
    PYTHON_TOOL_PROJECT_FILE,
} from '#cli/config/gspot-paths.ts';

export const TOOL_PROJECT_FILES: ReadonlySet<string> = new Set([
    MISE_TOOL_PROJECT_FILE,
    NPM_TOOL_PROJECT_FILE,
    PYTHON_TOOL_PROJECT_FILE,
    YARN_SETTINGS,
]);
