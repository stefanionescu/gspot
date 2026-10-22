import { YARN_SETTINGS_FILE } from '#cli/config/install/npm/yarn.ts';
import { PROJECT_UV_LOCKFILE } from '#cli/config/install/python/project.ts';
import { NODE_MODULES, PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/files/names.ts';

/** The folder where gspot keeps what it installs and generates in a repository. */
export const DOT_GSPOT = '.gspot';

/** The paths inside the gspot folder. */
export const GSPOT_PATHS = {
    /** One folder for each group and configuration, which holds its config files and rules. */
    configurations: `${DOT_GSPOT}/configurations`,
    /** The hook scripts that core.hooksPath names. */
    hooks: `${DOT_GSPOT}/hooks`,
    /** The locks and temporary run files, never committed. */
    state: `${DOT_GSPOT}/state`,
    versionPin: `${DOT_GSPOT}/version`,
    miseProject: `${DOT_GSPOT}/mise.toml`,
    npmProject: `${DOT_GSPOT}/package.json`,
    nodeModules: `${DOT_GSPOT}/${NODE_MODULES}`,
    yarnSettings: `${DOT_GSPOT}/${YARN_SETTINGS_FILE}`,
    pythonProject: `${DOT_GSPOT}/pyproject.toml`,
    pythonEnvironment: `${DOT_GSPOT}/${PYTHON_ENVIRONMENT_FOLDER}`,
    uvLockfile: `${DOT_GSPOT}/${PROJECT_UV_LOCKFILE}`,
    /** The downloaded Vale packages. The generated styles and your own styles live elsewhere. */
    valePackages: `${DOT_GSPOT}/vale`,
    valeConfigFile: `${DOT_GSPOT}/configurations/general/prose/vale.ini`,
} as const;

/** The tool project folder written and replaced for each installation kind. */
export const INSTALLED_TOOL_FOLDERS = {
    npm: GSPOT_PATHS.nodeModules,
    python: GSPOT_PATHS.pythonEnvironment,
    vale: GSPOT_PATHS.valePackages,
} as const;

/** The file inventory and the write plans leave out the state folder. */
export const STATE_FOLDER_PATTERN = new RegExp(`(?:^|/)\\${GSPOT_PATHS.state}(?:/|$)`, 'iu');
