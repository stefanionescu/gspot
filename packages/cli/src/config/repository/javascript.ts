export const LOCKFILES = [
    {
        file: 'bun.lock',
        configuration: 'javascript',
        packageManager: 'bun',
        toolProject: true,
        copied: true,
    },
    { file: 'bun.lockb', configuration: 'javascript', packageManager: 'bun' },
    {
        file: 'pnpm-lock.yaml',
        configuration: 'javascript',
        packageManager: 'pnpm',
        toolProject: true,
        copied: true,
    },
    {
        file: 'yarn.lock',
        configuration: 'javascript',
        packageManager: 'yarn',
        copied: true,
    },
    {
        file: 'package-lock.json',
        configuration: 'javascript',
        packageManager: 'npm',
        toolProject: true,
        copied: true,
    },
    { file: 'npm-shrinkwrap.json', configuration: 'javascript', packageManager: 'npm' },
    {
        file: 'uv.lock',
        configuration: 'python',
        packageManager: 'uv',
        copied: true,
    },
    { file: 'poetry.lock', configuration: 'python', packageManager: 'poetry' },
    { file: 'pdm.lock', configuration: 'python', packageManager: 'pdm' },
    { file: 'Cargo.lock', packageManager: 'cargo' },
    { file: 'go.sum', packageManager: 'go' },
    { file: 'Gemfile.lock', packageManager: 'bundler' },
    { file: 'Package.resolved', configuration: 'swift', packageManager: 'swift', copied: true },
    { file: 'Podfile.lock', packageManager: 'cocoapods' },
] as const;

export const CI_NODE = 'node@24.20.0';

export const SETUP_NODE_VERSION = '24';

export const SETUP_NODE = `node@${SETUP_NODE_VERSION}`;

export const MISE_NODE_PIN_COMMAND = `mise use --pin ${SETUP_NODE}`;

export const PACKAGE_MANAGER_HASH_SUFFIX = '+sha';

export const YARN_BERRY_MAJOR = 2;

export const NPM_TOOL = 'npm';

export const GSPOT_MISE_TOOL = 'npm:@gspothq/cli';

export const GSPOT_PACKAGES = ['@gspothq/cli', '@gspothq/eslint-plugin'] as const;

export const GSPOT_MISE_OPTIONS = { allow_low_downloads: 'true' } as const;

export const JSON_INDENT_PATTERN = /^[\t ]+(?=")/mu;

export const DEFAULT_JSON_INDENT = '  ';

export const LOCAL_PATH_PREFIX = './';

export const PATHS_BASE_OPTION = 'pathsBasePath';

export const PACKAGE_MANAGERS = ['npm', 'bun', 'pnpm', 'yarn'] as const;

export const HOOK_PROGRAM_MISSING =
    "<program> is not on the PATH that this Git client gives hooks ($PATH). Start the client from a terminal, or add <program>'s folder to its PATH.";

export const START_RUNNERS = {
    npm: {
        command: 'npm exec --no -- gspot',
        hasBinFolder: true,
        installCommand: 'npm install --save-dev --save-exact <package>@<version>',
    },
    pnpm: {
        command: 'pnpm exec gspot',
        hasBinFolder: true,
        installCommand: 'pnpm add --save-dev --save-exact <package>@<version>',
    },
    yarn: {
        command: 'yarn exec -- gspot',
        hasBinFolder: false,
        installCommand: 'yarn add --dev --exact <package>@<version>',
    },
    bun: {
        command: 'bunx --no-install gspot',
        hasBinFolder: true,
        installCommand: 'bun add --dev --exact <package>@<version>',
    },
    mise: {
        command: 'mise exec -- gspot',
        hasBinFolder: false,
        installCommand: 'mise use --pin --tool-option allow_low_downloads=true npm:<package>@<version>',
    },
} as const;

export const PNPM_WORKSPACE_FILE = 'pnpm-workspace.yaml';

export const PNPM_WORKSPACE_INSTALL = 'pnpm add --workspace-root --save-dev --save-exact <package>@<version>';

export const LERNA_FILE = 'lerna.json';

export const RUSH_FILE = 'rush.json';

export const IMPORT_CONDITIONS = new Set(['node', 'import', 'default']);

export const FROZEN_INSTALLS = {
    'package-lock.json': ['npm', 'ci'],
    'pnpm-lock.yaml': ['pnpm', 'install', '--frozen-lockfile'],
    'yarn.lock': ['yarn', 'install', '--frozen-lockfile'],
    'bun.lock': ['bun', 'install', '--frozen-lockfile'],
    'bun.lockb': ['bun', 'install', '--frozen-lockfile'],
    'uv.lock': ['uv', 'sync', '--locked'],
} as const satisfies Record<string, readonly string[]>;

export const YARN_BERRY_INSTALL = ['yarn', 'install', '--immutable'] as const;

export const PACKAGE_MANAGER_LABELS = { bun: 'Bun', npm: 'npm', pnpm: 'pnpm', yarn: 'Yarn', mise: 'mise' } as const;

export const VERSION_FLAG = '--version';
