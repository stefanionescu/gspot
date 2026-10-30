import { GSPOT_PATHS } from '#cli/config/files/gspot.ts';

export const TOOL_PROJECT_FILES: ReadonlySet<string> = new Set([
    GSPOT_PATHS.miseProject,
    GSPOT_PATHS.npmProject,
    GSPOT_PATHS.pythonProject,
]);

export const TOOL_PROJECTS_MESSAGE = 'The tool projects in .gspot do not match gspot.toml. Run gspot apply first.';

export const TOOLS_INSTALLED_MESSAGE = 'No change: every tool is installed.';

export const INSTALLATION_STOPPED_MESSAGE = 'Installation stopped before every tool was installed.';
