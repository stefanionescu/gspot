export const REQUIRED_HEADERS = {
    'x-content-type-options': /^nosniff$/iu,
    'referrer-policy': /\S/u,
    'x-frame-options': /^(?:deny|sameorigin)$/iu,
} as const;

export const HTTP_HEADER_LINE = /^[A-Za-z!][\w!#$%&'*+.^`|~-]*:\s*\S/u;

export const REDIRECT_STATUS_CODES = new Set(['200', '301', '302', '303', '307', '308']);

export const REDIRECT_PARTS = { minimum: 2, maximum: 3 } as const;

export const REDIRECTS_FILE = '_redirects';

export const FRAME_ANCESTORS = /frame-ancestors/iu;

export const PATH_PREFIXES = ['/', 'https://'] as const;

export const DETACH_PREFIX = '! ';

export const HEADERS_FILE = '_headers';
