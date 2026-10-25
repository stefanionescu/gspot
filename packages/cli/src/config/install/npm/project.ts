export const PACKAGE_MANAGER_ARGUMENTS = {
    yarn: {
        lockfile: ['install', '--mode=update-lockfile'],
        install: ['install', '--immutable'],
    },
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

export const YARN_SETTINGS_FILE_VARIABLE = 'YARN_RC_FILENAME';

export const NPM_SETTING_PREFIX = 'npm_config_';

export const NPMRC_FILE = '.npmrc';

export const NODE_TOOL = 'node';

export const YARN_ENABLE_SCRIPTS = 'YARN_ENABLE_SCRIPTS';
