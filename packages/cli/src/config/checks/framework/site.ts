export const HTML_REPORT_FILE = 'html-validate.json';

export const SITEMAP_LOCATION = /<loc>\s*(?<url>[^<\s]+)\s*<\/loc>/gu;

export const SITEMAP_FILE = /^sitemap.*\.xml$/u;

export const HTTP_OK_STATUS = 200;

export const LINKINATOR_PROGRAM = 'dist/linkinator-program.js';

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

export const SVGO_COMMAND = ['svgo', '--input', '-', '--output', '-'] as const;
export const GIT_FILE_MODES = ['100644', '100755'] as const;
export const SVG_EXTENSION = '.svg';
export const WEB_MANIFEST_EXTENSION = '.webmanifest';
export const HTML_FILE = /\.html?$/u;
export const MANIFEST_REL = 'manifest';
export const PLACEHOLDER_ORIGIN = 'https://site.invalid/';
export const LINKINATOR = 'linkinator';
export const LOCAL_HOSTS = ['localhost', '127.0.0.1'] as const;
export const INDEX_PAGE = 'index.html';
export const HTML_EXTENSION = '.html';
export const BROKEN_LINK = 'BROKEN';
export const HTML_VALIDATE = 'html-validate';
export const PURGECSS = 'purgecss';
export const CSS_EXTENSION = '.css';
export const PURGECSS_CONTENT = ['**/*.html', '**/*.js'] as const;
