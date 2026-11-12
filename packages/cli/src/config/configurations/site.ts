// build check

export const BUILD_RULE = 'build';

export const BUILD_SCRIPT = ['run', 'build'] as const;

export const UNBUILT_SITE_NOTE = 'The site did not build.';

// pages check

export const CSS_EXTENSION = '.css';

export const HTML_EXTENSION = '.html';

export const HTML_VALIDATE_FORMATTER_FLAG = '--formatter';

export const HTML_VALIDATE_OUTPUT = 'html-validate.json';

export const HTML_VALIDATE_TOOL = 'html-validate';

export const INDEX_PAGE = 'index.html';

export const LYCHEE_ARGUMENTS = [
    '--offline',
    '--include-fragments',
    '--index-files',
    INDEX_PAGE,
    '--fallback-extensions',
    'html',
    '--format',
    'detailed',
    '--no-progress',
] as const;

export const LYCHEE_TOOL = 'lychee';

export const PURGECSS_CONTENT = ['**/*.html', '**/*.js'] as const;

export const PURGECSS_PROCESS = 'selector-process';

export const PURGECSS_TOOL = 'purgecss';

export const REMAP_FLAG = '--remap';

export const ROOT_FOLDER_FLAG = '--root-dir';

export const SITEMAP_FILE = /^sitemap.*\.xml$/u;

export const SITE_RULES = {
    unusedSelector: 'unused-selector',
    missingPage: 'missing-page',
    unlistedPage: 'unlisted-page',
    invalidUrl: 'invalid-url',
} as const;

export const STYLE_COMPONENTS = new Set(['.astro', '.vue', '.svelte']);

export const STYLE_EXTENSIONS = new Set(['.css', '.scss', '.sass', '.less']);

export const STYLE_SCOPING = /:where\(\.astro-[a-z\d-]+\)|\[data-(?:astro-cid|v)-[a-z\d-]+\]|\.svelte-[a-z\d-]+/giu;

export const UNLISTED_PAGE_MESSAGE = 'The build wrote this page, and the sitemap does not list it.';

// sitemap check

export const SITEMAP_EXTENSION = '.xml';

export const SITEMAP_LOCATION = /<loc>(?:\s*<!\[CDATA\[(?<cdata>[\s\S]*?)\]\]>\s*|(?<url>[^<]*))<\/loc>/gu;

// unused-assets check

export const ALIAS_WILDCARD_SIDES = 2;

export const ASSET_FOLDER = /(?:^|\/)(?:assets|public|static)\//u;

export const ASSET_GLOB_CALL = 'import.meta.glob';

export const ASSET_REFERENCE_PREFIX = String.raw`(?<![\w./-])`;

export const ASSET_REFERENCE_SUFFIX = String.raw`(?=$|[^\w./-])`;

export const CONVENTIONAL_ASSETS =
    /(?:^|\/)(?:favicon\.ico|apple-touch-icon[^/]*\.png|CNAME|\.nojekyll|\.well-known\/.*)$/u;

export const TEXT_EXTENSIONS = new Set([
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
    '.mdx',
    '.cjs',
    '.mts',
    '.cts',
    '.less',
    '.sass',
    '.styl',
    '.njk',
    '.liquid',
    '.hbs',
    '.ejs',
    '.pug',
    '.toml',
    '.yml',
    '.yaml',
]);

export const UNUSED_ASSET_MESSAGE = 'No page, stylesheet or script names this file.';

export const UNUSED_ASSET_RULE = 'unused-asset';
