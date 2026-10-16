import { NODE_MODULES } from '#cli/config/repository/tracked.ts';
import { PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/tools/python.ts';

export const DOT_GSPOT = '.gspot';
export const TOOL_FILES_FOLDER = `${DOT_GSPOT}/config`;

export const SETTINGS_FILE = 'gspot.toml';

export const PYTHON_TOOL_PROJECT_FILE = `${DOT_GSPOT}/pyproject.toml`;

export const UV_LOCKFILE = `${DOT_GSPOT}/uv.lock`;

export const VALE_TOOL_FILE_PATH = `${TOOL_FILES_FOLDER}/vale.ini`;

/** The style directory Vale reads, where Vale packages land beside the gspot style. */
export const VALE_STYLES_PATH = `${TOOL_FILES_FOLDER}/vale/styles`;

/** Track upstream Vale packages apart from generated and written styles. */
export const VALE_PACKAGES_PATH = `${DOT_GSPOT}/vale`;

export const GSPOT_NODE_MODULES_PATH = `${DOT_GSPOT}/${NODE_MODULES}`;

export const GSPOT_PYTHON_ENVIRONMENT_PATH = `${DOT_GSPOT}/${PYTHON_ENVIRONMENT_FOLDER}`;

export const NPM_TOOL_PROJECT_FILE = `${DOT_GSPOT}/package.json`;

export const YARN_SETTINGS_FILE = '.yarnrc.yml';
export const YARN_SETTINGS = `${DOT_GSPOT}/${YARN_SETTINGS_FILE}`;

export const VERSION_PIN_FILE = `${DOT_GSPOT}/version`;

/** The locks and temporary run state, never committed. */
export const STATE_PATH = `${DOT_GSPOT}/state`;

/** The folder of the hook scripts gspot writes, which core.hooksPath names. */
export const HOOKS_PATH = `${DOT_GSPOT}/hooks`;

export const RULES_PATH = `${DOT_GSPOT}/rules`;

export const MISE_TOOL_PROJECT_FILE = `${DOT_GSPOT}/mise.toml`;

/** The tool project folder written and replaced for each installation kind. */
export const INSTALLED_TOOL_FOLDERS = {
    npm: GSPOT_NODE_MODULES_PATH,
    python: GSPOT_PYTHON_ENVIRONMENT_PATH,
    vale: VALE_PACKAGES_PATH,
} as const;

/** The lifecycle state folder never enters command checks or generated plans. */
export const STATE_FOLDER_PATTERN = new RegExp(`(?:^|/)\\${STATE_PATH}(?:/|$)`, 'iu');

/** The prefix of generated tool file paths. */
export const TOOL_FILE_PREFIX = `${TOOL_FILES_FOLDER}/`;

/** Tool folders replaced as complete installations. */
export const TOOL_FOLDER_KINDS = ['npm', 'python', 'vale'] as const;
