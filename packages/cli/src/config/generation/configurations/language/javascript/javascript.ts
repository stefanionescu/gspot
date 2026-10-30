export const JAVASCRIPT_BUNDLED_IMPORTS = { module: 'ESNext', moduleResolution: 'Bundler' } as const;

export const JAVASCRIPT_EXTENSIONS = ['js', 'mjs', 'cjs', 'jsx'] as const;

export const JAVASCRIPT_IGNORED_GLOBS = [
    '**/eslint.config.mjs',
    '**/eslint.config.js',
    '**/eslint.config.cjs',
] as const;

export const STANDALONE_OPTIONS = {
    target: 'ES2022',
    module: 'NodeNext',
    moduleResolution: 'NodeNext',
    jsx: 'preserve',
    resolveJsonModule: true,
} as const;

export const JAVASCRIPT_OPTIONS = {
    checkJs: true,
    strict: true,
    allowImportingTsExtensions: true,
    maxNodeModuleJsDepth: 0,
} as const;

export const SOURCE_SELECTION_FIELDS = ['files', 'include'] as const;

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

export const KNIP_TABLE = 'tools.knip';

export const KNIP_CHECK = 'javascript/knip';

export const UNQUOTED_COMMENT = /('[^']*'|"(?:[^"\\]|\\.)*")|(?<![^\s;&|()])#.*/gu;
