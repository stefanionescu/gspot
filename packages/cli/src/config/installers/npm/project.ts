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
