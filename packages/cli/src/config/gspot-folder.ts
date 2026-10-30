import { LOCKFILES } from '#cli/config/files/lockfiles.ts';

import {
    SCHEMA_FILE,
    UV_LOCKFILE,
    NODE_MODULES,
    MISE_LOCKFILE,
    MISE_CONFIG_FILE,
    PYTHON_ENVIRONMENT_FOLDER,
} from '#cli/config/files/names.ts';

export const GSPOT_FOLDER = '.gspot';

export const GSPOT_PATHS = {
    configurations: `${GSPOT_FOLDER}/configurations`,
    hooks: `${GSPOT_FOLDER}/hooks`,
    gitignore: `${GSPOT_FOLDER}/.gitignore`,
    settingsSchema: `${GSPOT_FOLDER}/${SCHEMA_FILE}`,
    miseProject: `${GSPOT_FOLDER}/${MISE_CONFIG_FILE}`,
    miseLockfile: `${GSPOT_FOLDER}/${MISE_LOCKFILE}`,
    npmProject: `${GSPOT_FOLDER}/package.json`,
    nodeModules: `${GSPOT_FOLDER}/${NODE_MODULES}`,
    pythonProject: `${GSPOT_FOLDER}/pyproject.toml`,
    pythonEnvironment: `${GSPOT_FOLDER}/${PYTHON_ENVIRONMENT_FOLDER}`,
    uvLockfile: `${GSPOT_FOLDER}/${UV_LOCKFILE}`,
    valePackages: `${GSPOT_FOLDER}/vale`,
    valeReleases: `${GSPOT_FOLDER}/vale/releases.json`,
    valeConfigFile: `${GSPOT_FOLDER}/configurations/general/prose/vale.ini`,
} as const;

export const INSTALLED_TOOL_FOLDERS = {
    npm: GSPOT_PATHS.nodeModules,
    python: GSPOT_PATHS.pythonEnvironment,
    vale: GSPOT_PATHS.valePackages,
} as const;

export const TOOL_LOCKFILES = new Set([
    ...LOCKFILES.map(({ file }) => `${GSPOT_FOLDER}/${file}`),
    GSPOT_PATHS.miseLockfile,
]);
