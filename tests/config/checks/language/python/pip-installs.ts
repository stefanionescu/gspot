export const LOCKED_SCOPE_SETTINGS = {
    level: 'all',
    scopes: [
        { path: 'locked', configurations: ['python'] },
        { path: 'other', configurations: ['python'] },
    ],
} as const;

export const REQUIREMENTS_FILE_FINDING = {
    check: 'python/pip-installs',
    file: 'locked/requirements.txt',
    line: 1,
    rule: 'requirements-file',
    fixable: false,
    message:
        'A hand-kept requirements file is a second owner of the dependencies. Export it from the lockfile and declare it generated, or delete it.',
    help: 'Export the requirements file from the lockfile, declare it generated, and replace `pip install` with the locked command. Accept a reviewed path with `gspot ignore python/pip-installs --paths <glob> --reason "<why>"`.',
} as const;
