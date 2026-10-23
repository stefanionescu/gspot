export const AGENTS_FILE = 'AGENTS.md';

export const REQUIREMENTS_FILE = /(?:^|\/)requirements[^/]*\.txt$/u;

export const JSCONFIG_FILE = 'jsconfig.json';

export const PBXPROJ_NAME = 'project.pbxproj';

export const MISE_SCRIPT_PATH = '.mise/tasks/**';

export const SWIFT_EXTENSION = '.swift';

export const PYTHON_ENVIRONMENT_FOLDER = '.venv';

export const NODE_MODULES = 'node_modules';

export const GITATTRIBUTES_FILE = '.gitattributes';

export const MISE_FILES = [
    '.mise.local.toml',
    'mise.local.toml',
    '.mise.toml',
    'mise.toml',
    'mise/config.toml',
    '.mise/config.toml',
    '.config/mise.toml',
    '.config/mise/config.toml',
] as const;

export const SQL_EXTENSION = '.sql';
