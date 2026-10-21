export const PYTHON_ENVIRONMENT_FOLDER = '.venv';

export const NODE_MODULES = 'node_modules';

export const INSTALLED_DEPENDENCY_FOLDERS: ReadonlySet<string> = new Set([
    NODE_MODULES,
    'bower_components',
    PYTHON_ENVIRONMENT_FOLDER,
    'venv',
    'Pods',
    'DerivedData',
    '.build',
]);

export const GITIGNORE_FILE = '.gitignore';

export const GIT_FOLDER = '.git';

export const GIT_INDEX_FILES_ARGUMENTS = ['ls-files', '--stage', '-z'] as const;

export const GITATTRIBUTES_FILE = '.gitattributes';

export const GIT_UNTRACKED_FILES_ARGUMENTS = ['ls-files', '--others', '--exclude-standard', '-z'] as const;
