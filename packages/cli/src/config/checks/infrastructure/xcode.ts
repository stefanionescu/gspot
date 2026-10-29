import { PBXPROJ_FILE } from '#cli/config/files/names.ts';

export const ASSET_CONTENTS = 'Contents.json';

export const XCASSETS_FOLDER = '.xcassets/';

export const IMAGE_SET = `.imageset/${ASSET_CONTENTS}`;

export const PLIST_SUFFIX = '.plist';

export const ASSET_REFERENCE_ENDINGS = [
    '.swift',
    '.storyboard',
    '.xib',
    PLIST_SUFFIX,
    PBXPROJ_FILE,
    '.xcconfig',
] as const;

export const NAMED_SETS = [IMAGE_SET, `.colorset/${ASSET_CONTENTS}`] as const;

export const ASSET_KIND_SUFFIX = /(?:Color|Image)$/u;

export const WORD_SEPARATOR = /[^A-Za-z\d]/u;

export const XCSTRINGS_SUFFIX = '.xcstrings';

export const DEFAULT_SOURCE_LANGUAGE = 'en';

export const ENTITLEMENTS_SUFFIX = '.entitlements';

export const PLIST_KEY = /<key>(?<name>[^<]+)<\/key>/gu;

export const INSECURE_TRANSPORT_SETTING = /<key>NSAllowsArbitraryLoads<\/key>\s*<true\s*\/>/u;

export const INSECURE_TRANSPORT_MESSAGE = 'NSAllowsArbitraryLoads is true, so every host may be reached without TLS.';

export const UNTARGETED_FILE_MESSAGE = 'This Swift file is in no target of the project.';

export const EMPTY_SET_MESSAGE = 'This image set names no image file.';

export const RULES = {
    unusedAsset: 'unused-asset',
    missingTranslation: 'missing-translation',
    entitlement: 'entitlement',
    arbitraryLoads: 'arbitrary-loads',
    untargeted: 'untargeted',
    emptySet: 'empty-set',
    missingImage: 'missing-image',
} as const;
