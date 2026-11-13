import type { JSONSchema4 } from '@typescript-eslint/utils/json-schema';

// disabled-resource-integrity rule
export const ALIASED_PATH = /\/[^/@]*@[\d.]+(?:-[\da-z][\d.a-z-]*)?(?=[#/?]|$)/iu;
export const CREATE_SCRIPT_SELECTOR =
    'VariableDeclarator[id.type="Identifier"][init.type="CallExpression"][init.callee.object.name="document"][init.callee.property.name="createElement"]';
export const REMOTE_PREFIXES = ['http', '//'] as const;
export const SCRIPT_TYPE = 'HTMLScriptElement';
export const VERSIONED_PATH = /\/v?\d+\.\d+(?:\.\d+)?(?:-[\da-z][\d.a-z-]*)?(?=[#/?]|$)/iu;

// dompurify-unsafe-config rule
export const DANGEROUS_TAGS: ReadonlySet<string> = new Set([
    'script',
    'iframe',
    'object',
    'embed',
    'form',
    'input',
    'textarea',
    'select',
    'meta',
    'link',
    'style',
    'base',
    'svg',
    'math',
]);
export const DANGEROUS_URI_ATTRIBUTES: ReadonlySet<string> = new Set([
    'href',
    'src',
    'action',
    'formaction',
    'xlink:href',
    'data',
]);
export const EVENT_LISTENER_ATTRIBUTE = /^on[a-z]/iu;
export const LIST_FORMAT = new Intl.ListFormat('en', { type: 'conjunction' });
export const SANITIZE_BOOLEAN_OPTIONS: Readonly<Record<string, boolean>> = {
    ALLOW_UNKNOWN_PROTOCOLS: true,
    WHOLE_DOCUMENT: true,
    SAFE_FOR_XML: false,
    SANITIZE_DOM: false,
    RETURN_TRUSTED_TYPE: false,
};
export const SANITIZE_CONFIG_ARGUMENT = 1;
export const SANITIZE_FUNCTIONS: ReadonlySet<string | undefined> = new Set([
    'dompurify.sanitize',
    'isomorphic-dompurify.sanitize',
]);
export const SANITIZE_LIST_OPTIONS: Readonly<Record<string, 'tags' | 'events' | 'uris'>> = {
    ADD_TAGS: 'tags',
    ALLOWED_TAGS: 'tags',
    ADD_ATTR: 'events',
    ALLOWED_ATTR: 'events',
    ADD_URI_SAFE_ATTR: 'uris',
};
export const URI_PATTERN_OPTION = 'ALLOWED_URI_REGEXP';

// no-any-origin-messages rule
export const ADD_LISTENER_SELECTOR =
    'CallExpression[callee.type="MemberExpression"][callee.property.name="addEventListener"][arguments.length>=2]';
export const ANY_TARGET_ORIGIN = '*';
export const COMPARED_EVENT_DEPTH = 2;
export const COMPARED_ORIGIN_DEPTH = 1;
export const DOM_LIBRARY_FILE = 'lib.dom.d.ts';
export const JQUERY_EVENT_MEMBER = 'originalEvent';
export const MESSAGE_EVENT = 'message';
export const MESSAGE_LISTENER_PROPERTY = 'onmessage';
export const ON_MESSAGE_SELECTOR =
    'AssignmentExpression[operator="="][left.type="MemberExpression"][left.computed=false][left.property.name="onmessage"]';
export const ORIGIN_MEMBER = 'origin';
export const POST_MESSAGE_SELECTOR =
    'CallExpression:matches([callee.name="postMessage"], [callee.property.name="postMessage"]):matches([arguments.length=2], [arguments.length=3])';
export const UNTYPED_TYPES: ReadonlySet<string> = new Set(['any', 'unknown']);
export const WINDOW_MEMBERS = ['postMessage', 'frames'] as const;
export const WINDOW_RECEIVERS: ReadonlySet<string> = new Set(['window', 'globalThis']);
export const WINDOW_TOKEN = /window/iu;

// no-client-environment rule
export const ALLOWED_ENVIRONMENT_NAMES = ['NODE_ENV'] as const;
export const CLIENT_DIRECTIVE = 'use client';
export const CLIENT_ENVIRONMENT_OPTIONS_SCHEMA = {
    type: 'object',
    properties: {
        client: {
            description: 'Treat selected files as client code without a use-client directive.',
            type: 'boolean',
        },
        publicPrefixes: {
            description: 'Prefixes allowed for public environment variables.',
            type: 'array',
            items: { type: 'string' },
        },
        allowedNames: {
            description: 'Environment variable names allowed in client code.',
            type: 'array',
            items: { type: 'string' },
        },
    },
    additionalProperties: false,
} satisfies JSONSchema4;
export const ENVIRONMENT_GETTER = 'get';
export const ENVIRONMENT_HOSTS = ['process', 'Bun', 'Deno'] as const;
export const ENVIRONMENT_PROPERTY = 'env';
export const PUBLIC_PREFIXES = ['NEXT_PUBLIC_'] as const;
export const VITE_ENVIRONMENT_NAMES = ['MODE', 'BASE_URL', 'PROD', 'DEV', 'SSR'] as const;

// no-unsafe-sanitizer-bypass rule
export const SANITIZER_BYPASS_METHODS = new Set([
    'bypassSecurityTrustHtml',
    'bypassSecurityTrustStyle',
    'bypassSecurityTrustScript',
    'bypassSecurityTrustUrl',
    'bypassSecurityTrustResourceUrl',
]);

// require-noopener rule
export const NO_OPENER_FEATURE = 'noopener';
export const WEB_URL = /^https?:\/\//u;
export const WINDOW_FEATURES_ARGUMENT = 2;
export const WINDOW_OPEN_SELECTOR =
    'CallExpression[callee.type="MemberExpression"][callee.computed=false][callee.property.name="open"]';

// require-server-only rule
export const SERVER_DIRECTIVE = 'use server';
export const SERVER_ONLY_MODULE = 'server-only';
