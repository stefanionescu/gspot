/** Arguments shared by uv execution and its installation preview. */
export const UV_LOCKFILE_ARGUMENTS = ['lock'] as const;
export const UV_VENV_ARGUMENTS = ['venv', '--relocatable', '.venv'] as const;
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
