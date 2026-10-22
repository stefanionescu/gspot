import { PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/files/names.ts';

export const UV_LOCKFILE_CREDENTIAL_MESSAGE =
    'The uv lockfile holds the index credentials of the repository. gspot kept the existing files. Remove the credentials from the index URL.';

/** The Python version that the Python tool project pins. */
export const PYTHON_VERSION = '3.13.16';

/**
 * Each uv command names the Python of the tool project, which wins over a UV_PYTHON variable and a .python-version file
 * of the repository.
 */
export const UV_LOCKFILE_ARGUMENTS = ['lock', '--python', PYTHON_VERSION] as const;

export const UV_VENV_ARGUMENTS = [
    'venv',
    '--python',
    PYTHON_VERSION,
    '--allow-existing',
    PYTHON_ENVIRONMENT_FOLDER,
] as const;

export const UV_INSTALL_ARGUMENTS = ['sync', '--locked', '--no-install-project', '--python', PYTHON_VERSION] as const;

export const PINNED_PACKAGE_NAME = /^[^=]+/u;

/** The lockfile name of a uv project. */
export const PROJECT_UV_LOCKFILE = 'uv.lock';
