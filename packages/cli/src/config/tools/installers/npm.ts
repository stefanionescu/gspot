export const INTEGRITY = /^sha(?:256|384|512)-[A-Za-z0-9+/]+={0,2}$/u;

export const LOCKFILE_WORKSPACE_KEYS = { npm: 'packages', bun: 'workspaces', pnpm: 'importers' } as const;

export const BUN_LOCKFILE = 'bun.lock';

export const PACKAGE_MANAGER_ARGUMENTS = {
    npm: {
        lockfile: [
            'install',
            '--package-lock-only',
            '--legacy-peer-deps',
            '--ignore-scripts',
            '--no-audit',
            '--no-fund',
            '--omit-lockfile-registry-resolved',
        ],
        install: [
            'install',
            '--no-save',
            '--legacy-peer-deps',
            '--ignore-scripts',
            '--no-audit',
            '--no-fund',
            '--omit-lockfile-registry-resolved',
        ],
    },
    bun: {
        lockfile: ['install', '--lockfile-only', '--linker', 'hoisted', '--network-concurrency=1'],
        install: ['install', '--frozen-lockfile', '--linker', 'hoisted'],
    },
    pnpm: {
        lockfile: ['install', '--lockfile-only', '--node-linker=hoisted', '--config.auto-install-peers=false'],
        install: [
            'install',
            '--frozen-lockfile',
            '--ignore-workspace',
            '--node-linker=hoisted',
            '--config.auto-install-peers=false',
        ],
    },
} as const;

export const NPM_CONFIG_FOLDER_VARIABLE = 'XDG_CONFIG_HOME';

export const NPM_SETTING_PREFIX = 'npm_config_';

export const NPMRC_FILE = '.npmrc';

export const NODE_TOOL = 'node';

export const RELEASE_AGE_VERSIONS = {
    npm: '11.19.0',
    pnpm: '10.16.0',
    bun: '1.3.0',
} as const;

export const NPM_LOCKFILE_CREDENTIAL_MESSAGE =
    'The npm lockfile holds the registry credentials of the repository. gspot kept the existing files. Remove the credentials from the registry URL.';

export const INSTALL_FAILURE = 'installation failed';

export const NPM_TOOL_NOUN = 'npm tool';

export const NODE_MISSING_MESSAGE = 'The npm tool project needs Node.js to create its lockfile. Install Node.js.';

export const LOCKFILE_FAILURE = 'lockfile resolution failed';

export const LOCKFILE_CREDENTIAL_MESSAGE =
    'The package manager wrote registry credentials into its lockfile. gspot kept the existing files.';

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

export const SECONDS_PER_DAY = 86_400;

export const RELEASE_AGE_FILES = { bun: 'bunfig.toml', pnpm: 'pnpm-workspace.yaml' } as const;

export const GSPOT_PACKAGES = ['@gspothq/cli', '@gspothq/eslint-plugin'] as const;

export const MINUTES_PER_DAY = 1440;
