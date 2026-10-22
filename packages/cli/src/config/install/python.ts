import { PYTHON_VERSION } from '#cli/config/generation/projects.ts';
import { PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/repository/tracked.ts';

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

export const INDEX_SETTINGS = new Set([
    'index',
    'index-url',
    'extra-index-url',
    'find-links',
    'index-strategy',
    'keyring-provider',
    'native-tls',
    'system-certs',
    'allow-insecure-host',
    'offline',
]);

export const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/iu;

export const UV_SETTINGS_FILE = 'uv.toml';

export const PINNED_PACKAGE_NAME = /^[^=]+/u;

export const UV_LOCKFILE_CREDENTIAL_MESSAGE =
    'The uv lockfile holds the index credentials of the repository. gspot kept the existing files. Remove the credentials from the index URL.';
