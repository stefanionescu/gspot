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

export const PROJECT_SETTINGS_LEVEL = 'project';

export const SETTINGS_FILE_KEYS = ['userconfig', 'globalconfig'] as const;

export const SETTINGS_FILE_MESSAGE =
    'The repository .npmrc moves the npm settings files with userconfig or globalconfig. gspot reads only the scope registries of the repository .npmrc for its tools. Remove those lines.';

export const INSECURE_TLS_MESSAGE =
    'The npm settings turn off TLS checks with strict-ssl=false. gspot installs its tools only over checked TLS. Remove strict-ssl=false, or set cafile to the certificate of your proxy.';
