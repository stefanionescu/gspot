import { PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/files/names.ts';

export const UV_LOCKFILE_CREDENTIAL_MESSAGE =
    'The uv lockfile holds the index credentials of the repository. gspot kept the existing files. Remove the credentials from the index URL.';

export const PYTHON_VERSION = '3.13.16';

export const UV_LOCKFILE_ARGUMENTS = ['lock', '--python', PYTHON_VERSION] as const;

export const UV_VENV_ARGUMENTS = [
    'venv',
    '--python',
    PYTHON_VERSION,
    '--allow-existing',
    PYTHON_ENVIRONMENT_FOLDER,
] as const;

export const UV_INSTALL_ARGUMENTS = ['sync', '--locked', '--no-install-project', '--python', PYTHON_VERSION] as const;

export const REQUIREMENT_PACKAGE_NAME = /^[^=]+/u;

export const PYTHON_DEFAULT_INDEX_ORIGIN = 'https://pypi.org';

export const PYTHON_PACKAGE_ORIGINS = ['https://files.pythonhosted.org'] as const;
