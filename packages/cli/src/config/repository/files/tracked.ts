import { NODE_MODULES, PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/files/names.ts';

export const EXECUTABLE_BITS = 0o111;

export const GIT_INDEX_FILES_ARGUMENTS = ['ls-files', '--stage', '-z'] as const;

export const GIT_UNTRACKED_FILES_ARGUMENTS = ['ls-files', '--others', '--exclude-standard', '-z'] as const;

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
