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

/** How many lines of build output accompany a failure. */
export const OUTPUT_TAIL_LINES = 10;

/** How many changed output files a reproducibility failure lists. */
export const SHOWN_DIFFERENCES = 10;
