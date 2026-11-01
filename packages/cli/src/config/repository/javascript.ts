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

export const SETUP_NODE = 'node@24';

export const PACKAGE_MANAGER_HASH_SUFFIX = '+sha';

export const YARN_BERRY_MAJOR = 2;

export const NPM_TOOL = 'npm';

export const GSPOT_MISE_TOOL = 'npm:@gspothq/cli';

export const GSPOT_MISE_OPTIONS = { allow_low_downloads: 'true' } as const;

export const PIN_JSON_FORMAT = { formattingOptions: { insertSpaces: true, tabSize: 2 } } as const;

export const LOCAL_PATH_PREFIX = './';

export const PATHS_BASE_OPTION = 'pathsBasePath';

export const PACKAGE_MANAGERS = ['npm', 'bun', 'pnpm', 'yarn'] as const;

export const START_RUNNERS = {
    npm: {
        command: 'npm exec --no -- gspot',
        missing:
            "npm is not on the PATH that this Git client gives hooks ($PATH). Start the client from a terminal, or add npm's folder to its PATH.",
        installCommand: 'npm install --save-dev --save-exact <package>@<version>',
    },
    pnpm: {
        command: 'pnpm exec gspot',
        missing:
            "pnpm is not on the PATH that this Git client gives hooks ($PATH). Start the client from a terminal, or add pnpm's folder to its PATH.",
        installCommand: 'pnpm add --save-dev --save-exact <package>@<version>',
    },
    yarn: {
        command: 'yarn exec -- gspot',
        missing:
            "yarn is not on the PATH that this Git client gives hooks ($PATH). Start the client from a terminal, or add yarn's folder to its PATH.",
        installCommand: 'yarn add --dev --exact <package>@<version>',
    },
    bun: {
        command: 'bunx --no-install gspot',
        missing:
            "bunx is not on the PATH that this Git client gives hooks ($PATH). Start the client from a terminal, or add bunx's folder to its PATH.",
        installCommand: 'bun add --dev --exact <package>@<version>',
    },
    mise: {
        command: 'mise exec -- gspot',
        missing:
            "mise is not on the PATH that this Git client gives hooks ($PATH). Start the client from a terminal, or add mise's folder to its PATH.",
        installCommand: 'mise use --pin --tool-option allow_low_downloads=true npm:<package>@<version>',
    },
} as const;

export const PNPM_WORKSPACE_FILE = 'pnpm-workspace.yaml';

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
