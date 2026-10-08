export const HTML_REPORT_FILE = 'html-validate.json';

export const SITEMAP_LOCATION = /<loc>\s*(?<url>[^<\s]+)\s*<\/loc>/gu;

export const SITEMAP_FILES = ['sitemap-index.xml', 'sitemap.xml'];

export const LINKINATOR_STATUS_ACTIONS = ['ok', 'warn', 'skip', 'error'];

export const HTTP_OK_STATUS = 200;

export const LINKINATOR_PROGRAM = 'dist/linkinator.js';

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

/** How many changed output files a reproducibility failure lists. */
export const SHOWN_DIFFERENCES = 10;
