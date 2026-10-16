export const SETTING_REFERENCE = /\$[({]/u;

export const PBXPROJ = '.xcodeproj/project.pbxproj';

export const PBXPROJ_NAME = 'project.pbxproj';

/** Sticky tokenization refuses unclosed strings, comments, and unsupported syntax. */
export const PROJECT_TOKEN =
    // eslint-disable-next-line sonarjs/regex-complexity -- reason: The lexer must distinguish strings, two comment forms, punctuation, and bare project tokens in one anchored match.
    /\s+|\/\*[\s\S]*?\*\/|\/\/[^\r\n]*|"(?:\\[\s\S]|[^"\\])*"|[{}()=;,]|(?:\/(?![*/])|[^\s{}()=;,"/])+/u;

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
