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

export const GROUP_CYCLE_MESSAGE = 'The Xcode project contains a group cycle.';

export const MISSING_FILE_REF_MESSAGE = 'An Xcode source build entry has no file reference.';

export const MISSING_ROOT_MESSAGE = 'The Xcode project has no project root.';

export const MISSING_MAIN_GROUP_MESSAGE = 'The Xcode project has no main group.';

export const INVALID_STRING_MESSAGE = 'The Xcode project has an invalid string.';

export const TRAILING_TEXT_MESSAGE = 'The Xcode project has text after its root dictionary.';

export const OCTAL_ESCAPE_START = /^[0-7]/u;
