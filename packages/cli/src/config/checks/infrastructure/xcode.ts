import { PBXPROJ_NAME } from '#cli/config/files/names.ts';

export const ASSET_CONTENTS = 'Contents.json';

export const XCASSETS_FOLDER = '.xcassets/';

export const IMAGE_SET = `.imageset/${ASSET_CONTENTS}`;

export const PLIST_SUFFIX = '.plist';

export const ASSET_REFERENCE_ENDINGS = [
    '.swift',
    '.storyboard',
    '.xib',
    PLIST_SUFFIX,
    PBXPROJ_NAME,
    '.xcconfig',
] as const;

export const NAMED_SETS = [IMAGE_SET, `.colorset/${ASSET_CONTENTS}`] as const;

export const ASSET_KIND_SUFFIX = /(?:Color|Image)$/u;

export const NOT_WORD = /[^A-Za-z\d]/u;

export const XCSTRINGS_SUFFIX = '.xcstrings';

export const DEFAULT_SOURCE_LANGUAGE = 'en';

export const ENTITLEMENTS_SUFFIX = '.entitlements';

export const PLIST_KEY = /<key>(?<name>[^<]+)<\/key>/gu;

export const INSECURE_TRANSPORT_SETTING = /<key>NSAllowsArbitraryLoads<\/key>\s*<true\s*\/>/u;
