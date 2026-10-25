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

export const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/iu;

export const HTTP_URL = /^https?:\/\//u;

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

export const UV_SETTINGS_FILE = 'uv.toml';

export const MILLISECONDS_PER_DAY = 86_400_000;

export const PYTHON_TOOL_PROJECT = {
    name: 'tools',
    version: '0.0.0',
    'requires-python': `==${PYTHON_VERSION}`,
} as const;
