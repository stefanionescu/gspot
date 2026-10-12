/** The required Wrangler fields absent from its native package schema. */
export const WRANGLER_FIELDS = {
    name: { pattern: /\S/u, rule: 'missing-name', message: 'The configuration names no worker.' },
    compatibility_date: {
        pattern: /^\d{4}-\d{2}-\d{2}$/u,
        rule: 'compatibility-date',
        message: 'The configuration pins no compatibility_date, so the runtime behavior changes under it.',
    },
} as const;

export const REQUIRED_HEADERS = {
    'x-content-type-options': /^nosniff$/iu,
    'referrer-policy': /\S/u,
    'x-frame-options': /^(?:deny|sameorigin)$/iu,
} as const;

export const HTTP_HEADER_LINE = /^[A-Za-z!][\w!#$%&'*+.^`|~-]*:\s*\S/u;

export const REDIRECT_STATUS_CODES = new Set(['200', '301', '302', '303', '307', '308']);

export const REDIRECT_PARTS = { least: 2, most: 3 } as const;

export const REDIRECTS_FILE = '_redirects';

export const WRANGLER_FILES = ['wrangler.toml', 'wrangler.json', 'wrangler.jsonc'] as const;

export const FRAME_ANCESTORS = /frame-ancestors/iu;

export const SOURCE_PREFIXES = ['/', 'https://'] as const;
export const DETACH_PREFIX = '! ';
