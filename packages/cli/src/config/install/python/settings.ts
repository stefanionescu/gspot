export const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/iu;

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
