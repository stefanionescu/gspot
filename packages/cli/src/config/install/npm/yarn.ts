export const YARN_SECRET_KEYS: ReadonlySet<string> = new Set(['npmAuthToken', 'npmAuthIdent']);

export const YARN_SETTING_VARIABLE_PREFIX = 'GSPOT_YARN_SETTING_';

export const YARN_ENVIRONMENT_SETTINGS = [
    { pattern: /^npm_config_@([^:]+):registry$/u, setting: 'npmScopes', field: 'npmRegistryServer', defaults: {} },
    {
        pattern: /^npm_config_(\/\/[^\s]+):_authToken$/u,
        setting: 'npmRegistries',
        field: 'npmAuthToken',
        defaults: { npmAlwaysAuth: true },
    },
] as const;

export const YARN_SETTING_KEYS = {
    npmRegistryServer: 'npmRegistryServer',
    unsafeHttpWhitelist: 'unsafeHttpWhitelist',
    npmMinimalAgeGate: 'npmMinimalAgeGate',
    npmPreapprovedPackages: 'npmPreapprovedPackages',
} as const;

export const YARN_CONFIG_LIST_ARGUMENTS = ['config', '--json', '--no-defaults'] as const;

export const YARN_CONNECTION_KEYS = new Set([
    'npmRegistryServer',
    'npmRegistries',
    'npmScopes',
    'npmAuthToken',
    'npmAuthIdent',
    'npmAlwaysAuth',
    'httpProxy',
    'httpsProxy',
    'enableStrictSsl',
    'httpsCaFilePath',
    'httpsCertFilePath',
    'httpsKeyFilePath',
    'networkSettings',
    'unsafeHttpWhitelist',
]);

export const YARN_CONFIG_GET_ARGUMENTS = ['config', 'get'] as const;

export const YARN_CONFIG_GET_FLAGS = ['--json', '--no-redacted'] as const;

export const YARN_INSTALL_SETTINGS_FILE = '.yarnrc-install.yml';
