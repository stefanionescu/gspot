// The literal values checks/nginx reads: names, patterns, limits, and tables.

export const NGINX_ESCAPES: Record<string, string> = { t: '\t', r: '\r', n: '\n', '"': '"', "'": "'", '\\': '\\' };
export const WORD_START_STOPS = /[\s"'{};#\\]/u;
export const WORD_STOPS = /[\s{};\\]/u;
export const NGINX_PUNCTUATION = new Set([';', '{', '}']);
export const MAIN_FILE = 'nginx.conf';
export const DEFAULT_IMAGE = 'nginx:stable-alpine';
export const CERTIFICATE_ARGUMENTS = [
    'req',
    '-x509',
    '-nodes',
    '-newkey',
    'rsa:2048',
    '-subj',
    '/CN=localhost',
    '-days',
    '1',
];
export const LOCAL_NAMES = new Set(['localhost', 'unix']);
