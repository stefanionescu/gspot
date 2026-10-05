export const XCODE_PROJECT_FILE = '.xcodeproj/project.pbxproj';

export const NOT_WORD = /[^A-Za-z\d]/u;

export const IMAGE_SET = '.imageset/Contents.json';

export const NAMED_SETS = [IMAGE_SET, '.colorset/Contents.json'];

export const SETTING_NAME = /^[A-Za-z_][\w.[\]=*,-]*$/u;

export const INCLUDE_LINE = /^#include\??\s+"[^"]+"$/u;

export const PLIST_KEY = /<key>(?<name>[^<]+)<\/key>/gu;

export const ARBITRARY_LOADS = /<key>NSAllowsArbitraryLoads<\/key>\s*<true\s*\/>/u;
