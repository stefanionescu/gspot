// The literal values checks/general/site reads: names, patterns, limits, and tables.

export const SITE_OUTPUT = 'dist';
export const SITEMAP_LOCATION = /<loc>\s*(?<url>[^<\s]+)\s*<\/loc>/gu;

// Below the all level, svgo must save a tenth of the file before the saving is reported.
export const SVGO_SAVING = 10;
export const TEXT_SUFFIX = /\.(?:html?|css|scss|m?js|ts|json|webmanifest|xml|txt|md|toml|ya?ml)$/u;
export const ASSET_FOLDER = /(?:^|\/)assets\//u;
export const REQUIRED_HEADERS: Record<string, RegExp> = {
    'x-content-type-options': /^nosniff$/iu,
    'referrer-policy': /\S/u,
    'x-frame-options': /^(?:deny|sameorigin)$/iu,
};
export const SITE_BUILD = 'npm run build';
export const SHOWN_LINES = 10;
