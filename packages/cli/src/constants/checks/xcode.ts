// The literal values checks/xcode reads: names, patterns, limits, and tables.

export const XCODE_PROJECT_FILE = '.xcodeproj/project.pbxproj';
export const PBXPROJ_ESCAPES: Record<string, string> = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' };
export const PBXPROJ_PUNCTUATION = new Set(['{', '}', '(', ')', '=', ';', ',']);
export const SYMLINK_MODE = '120000';
export const WORD_CHARACTER = /[A-Za-z0-9_.$/+-]/u;
export const BUILD_SETTING = /\$[({]/u;
export const SETTING_NAME = /^[A-Za-z_][\w.[\]=*,-]*$/u;
export const INCLUDE_LINE = /^#include\??\s+"[^"]+"$/u;
export const PLIST_KEY = /<key>(?<name>[^<]+)<\/key>/gu;
export const ARBITRARY_LOADS = /<key>NSAllowsArbitraryLoads<\/key>\s*<true\s*\/>/u;
export const NOT_WORD = /[^A-Za-z\d]/u;
export const IMAGE_SET = '.imageset/Contents.json';
export const NAMED_SETS = ['.imageset/Contents.json', '.colorset/Contents.json'];
