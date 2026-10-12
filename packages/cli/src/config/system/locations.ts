export const TOOL_FILE_DIRECTORY = '.gspot/config';

export const SETTINGS_FILE = 'gspot.toml';

export const PYTHON_TOOL_PROJECT_FILE = '.gspot/pyproject.toml';

export const UV_LOCKFILE = '.gspot/uv.lock';

export const VALE_CONFIG = '.gspot/config/vale.ini';

/** The style directory Vale reads, where Vale packages land beside the gspot style. */
export const STYLES_DIRECTORY = '.gspot/config/vale/styles';

/** Track upstream Vale packages apart from generated and written styles. */
export const VALE_PACKAGE_DIRECTORY = '.gspot/vale';

export const NODE_MODULES_DIRECTORY = '.gspot/node_modules';

export const PYTHON_ENVIRONMENT_DIRECTORY = '.gspot/.venv';

export const NPM_TOOL_PROJECT_FILE = '.gspot/package.json';

export const YARN_SETTINGS = '.gspot/.yarnrc.yml';

/** The folder gspot writes for a repository; every path below sits inside it. */
export const DOT_GSPOT = '.gspot';

export const VERSION_PIN_FILE = '.gspot/version';

/** The gspot state: the ownership log and locks, never committed. */
export const STATE_DIRECTORY = '.gspot/state';

/** The folder of the hook scripts gspot writes, which core.hooksPath names. */
export const HOOKS_DIRECTORY = '.gspot/hooks';

export const RULES_DIRECTORY = '.gspot/rules';

export const MISE_TOOL_PROJECT_FILE = '.gspot/mise.toml';

/** The tool project folder written and replaced for each installation kind. */
export const INSTALLED_TOOL_FOLDERS = {
    npm: NODE_MODULES_DIRECTORY,
    python: PYTHON_ENVIRONMENT_DIRECTORY,
    vale: VALE_PACKAGE_DIRECTORY,
} as const;

/** The lifecycle state folder never enters command checks or generated plans. */
export const STATE_FOLDER_PATTERN = new RegExp(`(?:^|/)\\${STATE_DIRECTORY}(?:/|$)`, 'iu');

/** The prefix of generated native tool configuration paths. */
export const TOOL_FILE_PREFIX = `${TOOL_FILE_DIRECTORY}/`;

/** Tool folders replaced as complete installations. */
export const TOOL_FOLDER_KINDS = ['npm', 'python', 'vale'] as const;
