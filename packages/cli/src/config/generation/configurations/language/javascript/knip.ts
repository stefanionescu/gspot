export const KNIP_JAVASCRIPT_ENTRY_FILES = ['src/main.{ts,js}', 'src/index.{ts,js}'] as const;

export const KNIP_IGNORED_DEPENDENCIES = ['@gspothq/cli'] as const;

export const COMMAND_WORD_SEPARATORS = /[\s;&|()]+/u;

export const PACKAGE_RUNNERS: Readonly<Record<string, readonly string[]>> = {
    bunx: [],
    npx: [],
    bun: ['x'],
    npm: ['exec'],
    pnpm: ['exec', 'dlx'],
    yarn: ['exec', 'dlx'],
};

export const MISE_FILE_TASK_GLOBS = [
    '**/mise-tasks/**',
    '**/.mise-tasks/**',
    '**/mise/tasks/**',
    '**/.mise/tasks/**',
    '**/.config/mise/tasks/**',
] as const;

export const KNIP_ESLINT_CONFIG = 'eslint.config.mjs';
