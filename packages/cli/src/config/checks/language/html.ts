export const SURROUNDING_QUOTES = /^["']|["']$/gu;

export const EXECUTABLE_SCRIPT_TYPES: ReadonlySet<string> = new Set([
    '',
    'module',
    'application/ecmascript',
    'application/javascript',
    'application/x-ecmascript',
    'application/x-javascript',
    'text/ecmascript',
    'text/javascript',
    'text/javascript1.0',
    'text/javascript1.1',
    'text/javascript1.2',
    'text/javascript1.3',
    'text/javascript1.4',
    'text/javascript1.5',
    'text/jscript',
    'text/livescript',
    'text/x-ecmascript',
    'text/x-javascript',
]);

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
