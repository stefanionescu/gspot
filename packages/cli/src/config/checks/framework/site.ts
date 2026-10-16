export const HTML_REPORT_FILE = 'html-validate.json';

export const SITEMAP_LOCATION = /<loc>\s*(?<url>[^<\s]+)\s*<\/loc>/gu;

export const SITEMAP_FILE = /^sitemap.*\.xml$/u;

export const HTTP_OK_STATUS = 200;

export const LINKINATOR_PROCESS = 'dist/linkinator-process.js';

export const TEXT_SUFFIXES = new Set([
    '.htm',
    '.html',
    '.css',
    '.scss',
    '.js',
    '.mjs',
    '.jsx',
    '.ts',
    '.tsx',
    '.astro',
    '.vue',
    '.svelte',
    '.json',
    '.webmanifest',
    '.xml',
    '.txt',
    '.md',
    '.toml',
    '.yml',
    '.yaml',
]);

export const ASSET_FOLDER = /(?:^|\/)(?:assets|public|static)\//u;

/** How many lines of build output accompany a failure. */
export const OUTPUT_TAIL_LINES = 10;

export const LINKINATOR_STATES = ['OK', 'BROKEN', 'SKIPPED'] as const;
export const GIT_FILE_MODES: ReadonlySet<string> = new Set(['100644', '100755']);
export const LINKINATOR = 'linkinator';
export const LOCAL_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1']);
export const INDEX_PAGE = 'index.html';
export const HTML_EXTENSION = '.html';
export const BROKEN_LINK = 'BROKEN';
export const HTML_VALIDATE = 'html-validate';
export const PURGECSS = 'purgecss';
export const CSS_EXTENSION = '.css';
export const PURGECSS_CONTENT = ['**/*.html', '**/*.js'] as const;
