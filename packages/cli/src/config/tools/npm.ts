export const INTEGRITY = /^sha(?:256|384|512)-[A-Za-z0-9+/]+={0,2}$/u;

export const CREDENTIAL_KEY = /(?:_authToken|_auth|_password|key)$/iu;

export const ENCODED_CREDENTIAL_KEY = /(?:_auth|_password)$/u;

export const CONNECTION_URL_KEY = /registry$|(?:^|_)(?:https-)?proxy$/iu;

export const NPM_SETTING_PREFIX = 'npm_config_';

export const PACKAGE_SETTING_VARIABLE_PREFIX = 'GSPOT_PACKAGE_SETTING_';

export const YARN_SETTING_VARIABLE_PREFIX = 'GSPOT_YARN_SETTING_';

// A package that fetches its binary at install time can fail for a reason the package manager does not name.
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

export const YARN_ENVIRONMENT_SETTINGS = [
    { pattern: /^npm_config_@([^:]+):registry$/u, setting: 'npmScopes', field: 'npmRegistryServer', defaults: {} },
    {
        pattern: /^npm_config_(\/\/[^\s]+):_authToken$/u,
        setting: 'npmRegistries',
        field: 'npmAuthToken',
        defaults: { npmAlwaysAuth: true },
    },
] as const;

/** Resolve the lockfile, and install nothing into the tool project. */
export const LOCKFILE_ARGUMENTS = {
    npm: ['npm', 'install', '--package-lock-only', '--no-audit', '--no-fund', '--omit-lockfile-registry-resolved'],
    bun: ['bun', 'install', '--lockfile-only', '--linker', 'hoisted', '--network-concurrency=1'],
    pnpm: ['pnpm', 'install', '--lockfile-only', '--node-linker=hoisted'],
} as const;

/** Installation refuses any change to the recorded lockfile. */
export const INSTALL_ARGUMENTS = {
    npm: ['npm', 'ci', '--no-audit', '--no-fund', '--omit-lockfile-registry-resolved'],
    bun: ['bun', 'install', '--frozen-lockfile', '--linker', 'hoisted'],
    pnpm: ['pnpm', 'install', '--frozen-lockfile', '--ignore-workspace', '--node-linker=hoisted'],
} as const;

/** Yarn Classic and Berry declare different lockfile operations. */
export const YARN_ARGUMENTS = {
    classic: { lockfile: ['yarn', 'install'], install: ['yarn', 'install', '--frozen-lockfile'] },
    berry: { lockfile: ['yarn', 'install', '--mode=update-lockfile'], install: ['yarn', 'install', '--immutable'] },
} as const;

/** Descriptor separator in Yarn lockfile keys. */
export const YARN_DESCRIPTOR_SEPARATOR = /,\s*/u;

export const NPMRC_FILE = '.npmrc';
export const NPM_CONFIG_FOLDER_VARIABLE = 'XDG_CONFIG_HOME';
export const YARN_INSTALL_SETTINGS_FILE = '.yarnrc-install.yml';

export const NODE_TOOL = 'node';
export const NPM_PROGRAM = 'npm';
export const NYPM_DETECTION_OPTIONS = { ignoreArgv: true, ignorePackageJSON: true, includeParentDirs: false } as const;
export const NPM_SCOPE_REGISTRY_KEY = /^@[^\s:=]+:registry$/u;
export const REGISTRY_AUTH_KEY = /^\/\/[^\s]+:(?:_authToken|_auth|username|_password|certfile|keyfile)$/u;
export const CERTIFICATE_KEYS = [':certfile', ':keyfile'] as const;
export const REGISTRY_ALIASES = ['BUN_CONFIG_REGISTRY', 'YARN_REGISTRY'] as const;
export const YARN_CONFIG_LIST_ARGUMENTS = ['yarn', 'config', '--json', '--no-defaults'] as const;
export const YARN_CONFIG_GET_ARGUMENTS = ['yarn', 'config', 'get'] as const;
export const YARN_SECRET_KEYS: ReadonlySet<string> = new Set(['npmAuthToken', 'npmAuthIdent']);

export const MISSING_PACKAGE_MANAGER_MESSAGE =
    'No package manager is selected for the npm tool project. Run gspot apply first.';

export const LOCKFILE_WORKSPACE_KEYS = { npm: 'packages', bun: 'workspaces', pnpm: 'importers' } as const;

export const YARN_REGISTRY_VARIABLE = 'YARN_REGISTRY';
export const YARN_SETTINGS_FILE_VARIABLE = 'YARN_RC_FILENAME';
export const YARN_SETTING_KEYS = {
    npmRegistryServer: 'npmRegistryServer',
    unsafeHttpWhitelist: 'unsafeHttpWhitelist',
    npmMinimalAgeGate: 'npmMinimalAgeGate',
    npmPreapprovedPackages: 'npmPreapprovedPackages',
} as const;
export const YARN_CONFIG_GET_FLAGS = ['--json', '--no-redacted'] as const;
