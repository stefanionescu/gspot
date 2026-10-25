export const NGINX_ESCAPES: Readonly<Record<string, string>> = {
    t: '\t',
    r: '\r',
    n: '\n',
    '"': '"',
    "'": "'",
    '\\': '\\',
};

export const WORD_START_STOPS = /[\s"'{};#\\]/u;

export const WORD_STOPS = /[\s{};\\]/u;

export const NGINX_PUNCTUATION = new Set([';', '{', '}']);

export const ESCAPE_LENGTH = 2;

export const QUOTED_ARGUMENT = /^(["'])([\s\S]*)\1$/u;

export const ESCAPED_CHARACTER = /\\([trn"'\\])/gu;
