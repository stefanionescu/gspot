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

export const ASSET_FOLDER = /(?:^|\/)(?:assets|public|static)\//u;

export const UNUSED_ASSET_RULE = 'unused-asset';

export const UNUSED_ASSET_MESSAGE = 'No page, stylesheet or script names this file.';

export const CONVENTIONAL_ASSETS =
    /(?:^|\/)(?:favicon\.ico|apple-touch-icon[^/]*\.png|CNAME|\.nojekyll|\.well-known\/.*)$/u;

export const ASSET_REFERENCE_PREFIX = String.raw`(?<![\w./-])`;
export const ASSET_REFERENCE_SUFFIX = String.raw`(?=$|[^\w./-])`;
