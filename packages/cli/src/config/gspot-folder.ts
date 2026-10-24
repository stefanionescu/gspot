import { SCHEMA_FILE } from '#cli/config/settings/json-schema.ts';
import { YARN_SETTINGS_FILE } from '#cli/config/install/npm/yarn.ts';
import { LOCKFILES } from '#cli/config/parsers/projects/lockfiles.ts';
import { PROJECT_UV_LOCKFILE } from '#cli/config/install/python/project.ts';
import { NODE_MODULES, PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/files/names.ts';

export const DOT_GSPOT = '.gspot';

export const GSPOT_PATHS = {
    configurations: `${DOT_GSPOT}/configurations`,
    hooks: `${DOT_GSPOT}/hooks`,
    state: `${DOT_GSPOT}/state`,
    versionPin: `${DOT_GSPOT}/version`,
    settingsSchema: `${DOT_GSPOT}/${SCHEMA_FILE}`,
    miseProject: `${DOT_GSPOT}/mise.toml`,
    miseLockfile: `${DOT_GSPOT}/mise.lock`,
    npmProject: `${DOT_GSPOT}/package.json`,
    nodeModules: `${DOT_GSPOT}/${NODE_MODULES}`,
    yarnSettings: `${DOT_GSPOT}/${YARN_SETTINGS_FILE}`,
    pythonProject: `${DOT_GSPOT}/pyproject.toml`,
    pythonEnvironment: `${DOT_GSPOT}/${PYTHON_ENVIRONMENT_FOLDER}`,
    uvLockfile: `${DOT_GSPOT}/${PROJECT_UV_LOCKFILE}`,
    valePackages: `${DOT_GSPOT}/vale`,
    valeConfigFile: `${DOT_GSPOT}/configurations/general/prose/vale.ini`,
} as const;

export const INSTALLED_TOOL_FOLDERS = {
    npm: GSPOT_PATHS.nodeModules,
    python: GSPOT_PATHS.pythonEnvironment,
    vale: GSPOT_PATHS.valePackages,
} as const;

export const STATE_FOLDER_PATTERN = new RegExp(`(?:^|/)\\${GSPOT_PATHS.state}(?:/|$)`, 'iu');

export const TOOL_LOCKFILES = new Set([
    ...LOCKFILES.map(({ file }) => `${DOT_GSPOT}/${file}`),
    `${DOT_GSPOT}/mise.lock`,
]);
