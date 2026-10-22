export const SETTING_REFERENCE = /\$[({]/u;

export const PBXPROJ = '.xcodeproj/project.pbxproj';

export const PBXPROJ_NAME = 'project.pbxproj';

/**
 * One token of a project.pbxproj file. The parser matches each token right where the last one ended, so it stops at an
 * unclosed string or comment and at text that no branch matches.
 */
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
    a: '\u0007',
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
