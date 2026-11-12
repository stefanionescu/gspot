export const REQUIRED_HEADERS = {
    'x-content-type-options': /^nosniff$/iu,
    'referrer-policy': /\S/u,
    'x-frame-options': /^(?:deny|sameorigin)$/iu,
} as const;

export const HTTP_HEADER_LINE = /^[A-Za-z!][\w!#$%&'*+.^`|~-]*:\s*\S/u;

export const REDIRECT_STATUS_CODES = new Set(['200', '301', '302', '303', '307', '308']);

export const REDIRECT_FIELDS = { minimum: 2, maximum: 3 } as const;

export const REDIRECTS_FILE = '_redirects';

export const FRAME_ANCESTORS = /frame-ancestors/iu;

export const PATH_PREFIXES = ['/', 'https://'] as const;

export const DETACH_PREFIX = '! ';

export const HEADERS_FILE = '_headers';

export const MISSING_HEADER_RULE = 'missing-header';

export const HEADER_WITHOUT_PATH_MESSAGE = 'Add a path line before this header.';

export const MALFORMED_HEADER_MESSAGE = 'Write this header as Name: value.';

export const BLOCK_PATH_MESSAGE = 'Start this block with a path beginning with / or an https:// address.';

export const REDIRECT_FIELDS_MESSAGE = 'Write a redirect as a source, a destination, and an optional status.';

export const REDIRECT_SOURCE_MESSAGE = 'Start the source with /.';

export const INDENTED_LINE = /^\s/u;

export const REDIRECT_DESTINATION_MESSAGE = 'Start the destination with /, http:// or https://.';
