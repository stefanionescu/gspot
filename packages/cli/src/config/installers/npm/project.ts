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
            'ci',
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
