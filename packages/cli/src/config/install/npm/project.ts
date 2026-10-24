export const PACKAGE_MANAGER_ARGUMENTS = {
    yarn: {
        lockfile: ['yarn', 'install', '--mode=update-lockfile'],
        install: ['yarn', 'install', '--immutable'],
    },
    npm: {
        lockfile: [
            'npm',
            'install',
            '--package-lock-only',
            '--no-audit',
            '--no-fund',
            '--omit-lockfile-registry-resolved',
        ],
        install: ['npm', 'ci', '--no-audit', '--no-fund', '--omit-lockfile-registry-resolved'],
    },
    bun: {
        lockfile: ['bun', 'install', '--lockfile-only', '--linker', 'hoisted', '--network-concurrency=1'],
        install: ['bun', 'install', '--frozen-lockfile', '--linker', 'hoisted'],
    },
    pnpm: {
        lockfile: ['pnpm', 'install', '--lockfile-only', '--node-linker=hoisted'],
        install: ['pnpm', 'install', '--frozen-lockfile', '--ignore-workspace', '--node-linker=hoisted'],
    },
} as const;

export const NPM_CONFIG_FOLDER_VARIABLE = 'XDG_CONFIG_HOME';

export const YARN_SETTINGS_FILE_VARIABLE = 'YARN_RC_FILENAME';

export const NPM_SETTING_PREFIX = 'npm_config_';

export const NPMRC_FILE = '.npmrc';

export const NODE_TOOL = 'node';
