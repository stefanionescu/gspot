export const SURROUNDING_QUOTES = /^["']|["']$/gu;

export const INERT_SCRIPT_TYPES = new Set(['application/ld+json', 'application/json', 'importmap', 'speculationrules']);

export const URL_ATTRIBUTES = new Set(['href', 'xlink:href', 'src', 'action', 'formaction', 'data', 'background']);

export const DOCUMENT_URL_ATTRIBUTES: Readonly<Record<string, readonly string[]>> = {
    a: ['href', 'xlink:href'],
    area: ['href'],
    iframe: ['src'],
    frame: ['src'],
    object: ['data'],
    embed: ['src'],
} as const;

export const ACTIVE_DOCUMENT_TYPES = new Set(['text/html', 'application/xhtml+xml', 'image/svg+xml']);

export const EVENT_ATTRIBUTE = /^on[a-z]+$/u;

export const SCRIPT_SCHEMES = new Set(['javascript:', 'vbscript:']);

export const RELATIVE_URL_BASE = 'https://example.invalid';
