export const SITEMAP_LOCATION = /<loc>\s*(?<url>[^<\s]+)\s*<\/loc>/gu;

export const SITEMAP_EXTENSION = '.xml';

export const SITEMAP_FILE = /^sitemap.*\.xml$/u;

export const INDEX_PAGE = 'index.html';

export const HTML_EXTENSION = '.html';

export const LYCHEE = 'lychee';

export const LYCHEE_ARGUMENTS = [
    '--offline',
    '--include-fragments',
    '--index-files',
    'index.html',
    '--fallback-extensions',
    'html',
    '--format',
    'detailed',
    '--no-progress',
] as const;

export const HTML_VALIDATE = 'html-validate';

export const HTML_VALIDATE_CONFIG_FLAG = '--config';

export const HTML_VALIDATE_FORMATTER_FLAG = '--formatter';

export const HTML_REPORT_FILE = 'html-validate.json';

export const CSS_EXTENSION = '.css';

export const PURGECSS_PROCESS = 'dist/purgecss-process.js';

export const PURGECSS_CONTENT = ['**/*.html', '**/*.js'] as const;
