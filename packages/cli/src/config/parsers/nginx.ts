export const NGINX_ESCAPES: Record<string, string> = { t: '\t', r: '\r', n: '\n', '"': '"', "'": "'", '\\': '\\' };

export const WORD_START_STOPS = /[\s"'{};#\\]/u;

export const WORD_STOPS = /[\s{};\\]/u;

export const NGINX_PUNCTUATION = new Set([';', '{', '}']);
