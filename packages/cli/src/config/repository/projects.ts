import type { LOCKFILES } from '#cli/config/parsers/projects.ts';

// dependencies
export const HOOK_PACKAGES: ReadonlySet<string> = new Set(['husky', 'lefthook', 'lint-staged']);
export const REQUIREMENTS_FILE = /(?:^|\/)requirements[^/]*\.txt$/u;

// gspot pin
export const DEFAULT_JSON_INDENT = '  ';
export const GSPOT_MISE_OPTIONS = { allow_low_downloads: 'true' } as const;
export const GSPOT_MISE_TOOL = 'npm:@gspothq/cli';
export const GSPOT_PACKAGES = ['@gspothq/cli', '@gspothq/eslint-plugin'] as const;
export const JSON_INDENT_PATTERN = /^[\t ]+(?=")/mu;
export const SETUP_NODE_VERSION = '24';

// package managers
export const FROZEN_INSTALLS = {
    'package-lock.json': ['npm', 'ci'],
    'pnpm-lock.yaml': ['pnpm', 'install', '--frozen-lockfile'],
    'yarn.lock': ['yarn', 'install', '--frozen-lockfile'],
    'bun.lock': ['bun', 'install', '--frozen-lockfile'],
    'bun.lockb': ['bun', 'install', '--frozen-lockfile'],
    'uv.lock': ['uv', 'sync', '--locked'],
} as const satisfies Partial<Record<(typeof LOCKFILES)[number]['file'], readonly string[]>>;
export const PACKAGE_MANAGERS = ['npm', 'bun', 'pnpm', 'yarn'] as const;
export const PACKAGE_MANAGER_HASH_SUFFIX = '+sha';
export const YARN_BERRY_INSTALL = ['yarn', 'install', '--immutable'] as const;
export const YARN_BERRY_MAJOR = 2;

// start runners
const SETUP_NODE = `node@${SETUP_NODE_VERSION}`;
export const MISE_NODE_PIN_COMMAND = `mise use --pin ${SETUP_NODE}`;
export const PACKAGE_MANAGER_LABELS = { bun: 'Bun', npm: 'npm', pnpm: 'pnpm', yarn: 'Yarn', mise: 'mise' } as const;
export const PNPM_WORKSPACE_INSTALL = 'pnpm add --workspace-root --save-dev --save-exact <package>@<version>';
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

// workspaces
export const LERNA_FILE = 'lerna.json';
export const PNPM_WORKSPACE_FILE = 'pnpm-workspace.yaml';
export const RUSH_FILE = 'rush.json';
