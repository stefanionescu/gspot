export const NODE_MODULES = 'node_modules';

export const INSTALLED_DEPENDENCY_FOLDERS = [
    NODE_MODULES,
    'bower_components',
    '.venv',
    'venv',
    'Pods',
    'DerivedData',
    '.build',
] as const;

export const GITIGNORE_FILE = '.gitignore';
export const GIT_FOLDER = '.git';
export const INDEX_FILES_ARGUMENTS = ['ls-files', '--stage', '-z'] as const;

export const GITATTRIBUTES_FILE = '.gitattributes';

export const LICENSE_CHECKER_ARGUMENTS = ['--json', '--excludePrivatePackages', '--start'] as const;
export const UNKNOWN_LICENSE = 'UNKNOWN';
export const LICENSE_CHOICE = ' OR ';

export const UNTRACKED_FILES_ARGUMENTS = ['ls-files', '--others', '--exclude-standard', '-z'] as const;
