// aliases

export const IMPORT_CONDITIONS = new Set(['node', 'import', 'default']);

export const LOCAL_PATH_PREFIX = './';

// biome config

export const BIOME_TYPESCRIPT_FILES = ['**/*.{ts,tsx,mts,cts,astro,vue,svelte}'];

// checks

export const JAVASCRIPT_TSC_COMMAND = ['tsc', '-p'] as const;

export const JSCONFIG_TSBUILDINFO = 'jsconfig.check.tsbuildinfo';

// jsconfig config

export const JAVASCRIPT_BUNDLED_IMPORTS = { module: 'ESNext', moduleResolution: 'Bundler' } as const;

export const JAVASCRIPT_EXTENSIONS = ['js', 'mjs', 'cjs', 'jsx'] as const;

export const JAVASCRIPT_IGNORED_GLOBS = [
    '**/eslint.config.mjs',
    '**/eslint.config.js',
    '**/eslint.config.cjs',
] as const;

export const JAVASCRIPT_OPTIONS = {
    checkJs: true,
    strict: true,
    allowImportingTsExtensions: true,
    maxNodeModuleJsDepth: 0,
} as const;

export const SOURCE_SELECTION_FIELDS = ['files', 'include'] as const;

// knip config

export const HIDDEN_FILE_GLOB = /^\.[^.]+(?:\.\*)?$/u;

export const KNIP_CHECK = 'javascript/knip';

export const KNIP_ESLINT_CONFIG = 'eslint.config.mjs';

export const KNIP_IGNORED_DEPENDENCIES = ['@gspothq/cli'] as const;

export const KNIP_JAVASCRIPT_ENTRY_FILES = [
    '{index,cli,main}.{js,mjs,cjs,jsx,ts,tsx,mts,cts}',
    'src/{index,cli,main}.{js,mjs,cjs,jsx,ts,tsx,mts,cts}',
] as const;

export const PACKAGE_RUNNERS: Readonly<Record<string, readonly string[]>> = {
    bunx: [],
    npx: [],
    bun: ['x'],
    npm: ['exec'],
    pnpm: ['exec', 'dlx'],
    yarn: ['exec', 'dlx'],
};

export const UNQUOTED_COMMENT = /('[^']*'|"(?:[^"\\]|\\.)*")|(?<![^\s;&|()])#.*/gu;
