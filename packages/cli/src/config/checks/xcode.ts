import { PBXPROJ_NAME } from '#cli/config/parsers/xcode.ts';

export const NOT_WORD = /[^A-Za-z\d]/u;

export const IMAGE_SET = '.imageset/Contents.json';

export const NAMED_SETS = [IMAGE_SET, '.colorset/Contents.json'] as const;

export const PLIST_KEY = /<key>(?<name>[^<]+)<\/key>/gu;

export const ARBITRARY_LOADS = /<key>NSAllowsArbitraryLoads<\/key>\s*<true\s*\/>/u;

export const XCODEPROJ_SUFFIX = '.xcodeproj';

export const ASSET_CONTENTS = 'Contents.json';

export const XCASSETS_FOLDER = '.xcassets/';

export const ASSET_KIND_SUFFIX = /(?:Color|Image)$/u;

export const XCSTRINGS_SUFFIX = '.xcstrings';

export const DEFAULT_SOURCE_LANGUAGE = 'en';

export const ENTITLEMENTS_SUFFIX = '.entitlements';

export const PLIST_SUFFIX = '.plist';

export const ASSET_REFERENCE_ENDINGS = ['.swift', '.storyboard', '.xib', '.plist', PBXPROJ_NAME, '.xcconfig'] as const;
