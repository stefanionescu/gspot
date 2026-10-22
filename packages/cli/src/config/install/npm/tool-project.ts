/** Yarn Classic and Berry declare different lockfile operations. */
export const YARN_ARGUMENTS = {
    classic: { lockfile: ['yarn', 'install'], install: ['yarn', 'install', '--frozen-lockfile'] },
    berry: { lockfile: ['yarn', 'install', '--mode=update-lockfile'], install: ['yarn', 'install', '--immutable'] },
} as const;

/**
 * The arguments of each package manager: lockfile resolves the lockfile and installs nothing into the tool project, and
 * install refuses any change to the recorded lockfile.
 */
export const PACKAGE_MANAGER_ARGUMENTS = {
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

export const YARN_REGISTRY_VARIABLE = 'YARN_REGISTRY';

export const YARN_SETTINGS_FILE_VARIABLE = 'YARN_RC_FILENAME';

export const NPM_SETTING_PREFIX = 'npm_config_';

export const NPMRC_FILE = '.npmrc';

export const NODE_TOOL = 'node';
