import { PYTHON_VERSION } from '#cli/config/parsers/dependency-files.ts';

export const PYTHON_ENVIRONMENT_FOLDER = '.venv';

/** Arguments shared by uv execution and its installation preview. */
export const UV_LOCKFILE_ARGUMENTS = ['lock'] as const;
export const UV_VENV_ARGUMENTS = [
    'venv',
    '--python',
    PYTHON_VERSION,
    '--allow-existing',
    PYTHON_ENVIRONMENT_FOLDER,
] as const;
export const UV_INSTALL_ARGUMENTS = ['sync', '--locked', '--no-install-project'] as const;
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

export const UV_TOOL = 'uv';
export const UV_SETTINGS_FILE = 'uv.toml';
export const UV_RUN_ARGUMENTS = ['run', '--no-sync'] as const;
export const PINNED_PACKAGE_NAME = /^[^=]+/u;

export const PIP_LICENSES_COMMAND = [
    'pip-licenses',
    '--format=json',
    '--with-system',
    '--from=mixed',
    '--python',
] as const;

export const UV_LOCKFILE_CREDENTIAL_MESSAGE =
    'The uv lockfile includes repository index credentials. Existing files were preserved. Remove credentials from the index URL and run: gspot install';
