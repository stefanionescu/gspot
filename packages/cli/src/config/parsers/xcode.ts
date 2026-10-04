export const PBXPROJ_ESCAPES: Record<string, string> = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' };

export const PBXPROJ_PUNCTUATION = new Set(['{', '}', '(', ')', '=', ';', ',']);

export const WORD_CHARACTER = /[A-Za-z0-9_.$/+-]/u;

export const SETTING_REFERENCE = /\$[({]/u;
