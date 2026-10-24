export const SETTING_REFERENCE = /\$[({]/u;

export const PROJECT_TOKENS = [
    /\s+/y,
    /\/\*[\s\S]*?\*\//y,
    /\/\/[^\r\n]*/y,
    /"(?:\\[\s\S]|[^"\\])*"/y,
    /[{}()=;,]/y,
    /(?:\/(?![*/])|[^\s{}()=;,"/])+/y,
] as const;

export const PROJECT_PUNCTUATION: ReadonlySet<string> = new Set(['{', '}', '(', ')', '=', ';', ',']);

export const PROJECT_ESCAPE = /\\(U[\dA-Fa-f]{4}|[0-7]{1,3}|[\s\S])/gu;

export const PROJECT_ESCAPES: Readonly<Record<string, string>> = {
    a: '\u{7}',
    b: '\b',
    f: '\f',
    n: '\n',
    r: '\r',
    t: '\t',
    v: '\v',
    '"': '"',
    "'": "'",
    '\\': '\\',
    '\n': '\n',
};
