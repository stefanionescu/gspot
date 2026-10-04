export const INERT_SCRIPT_TYPES = new Set(['application/ld+json', 'application/json', 'importmap', 'speculationrules']);

export const URL_ATTRIBUTES = new Set(['href', 'xlink:href', 'src', 'action', 'formaction', 'data', 'background']);

export const DOCUMENT_URL_ATTRIBUTES: Record<string, string[]> = {
    a: ['href', 'xlink:href'],
    area: ['href'],
    iframe: ['src'],
    frame: ['src'],
    object: ['data'],
    embed: ['src'],
};

export const ACTIVE_DOCUMENT_TYPES = new Set(['text/html', 'application/xhtml+xml', 'image/svg+xml']);

export const COPY_ATTRIBUTES = new Set(['alt', 'aria-label', 'aria-description', 'placeholder', 'title']);

// The marks that open and close a placeholder in the template languages a static site uses.
export const PLACEHOLDER_MARKS: [string, string][] = [
    ['{{', '}}'],
    ['{%', '%}'],
    ['<%', '%>'],
    ['${', '}'],
];

export const SHOWN_TEXT = 40;

export const LETTERS = /\p{L}{2,}/u;
