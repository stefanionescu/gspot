export const CREDENTIAL_KEY = /(?:_authToken|_auth|_password|key)$/iu;

export const ENCODED_CREDENTIAL_KEY = /(?:_auth|_password)$/u;

export const CONNECTION_URL_KEY = /registry$|(?:^|_)(?:https-)?proxy$/iu;

export const NPM_SETTING_VARIABLE_PREFIX = 'GSPOT_PACKAGE_SETTING_';

export const CONNECTION_KEYS = new Set([
    'registry',
    'proxy',
    'https-proxy',
    'noproxy',
    'strict-ssl',
    'ca',
    'cafile',
    'cert',
    'key',
    'always-auth',
]);

export const NPM_SCOPE_REGISTRY_KEY = /^@[^\s:=]+:registry$/u;

export const REGISTRY_AUTH_KEY = /^\/\/[^\s]+:(?:_authToken|_auth|username|_password|certfile|keyfile)$/u;

export const CERTIFICATE_KEYS = [':certfile', ':keyfile'] as const;

export const READ_REGISTRY_MESSAGE = 'Cannot read the registry settings. Check the .npmrc files.';

export const REGISTRY_URL_MESSAGE = 'A registry URL in the .npmrc files is not valid.';

export const NPMRC_SETTINGS_MESSAGE = 'The .npmrc settings are not valid.';
