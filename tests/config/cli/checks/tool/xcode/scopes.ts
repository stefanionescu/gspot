/** Invalid documents must report source findings rather than execution errors. */
export const INVALID_XCODE_DOCUMENTS = [
    ['xcode/test-plans', 'App.xctestplan', '{'],
    ['xcode/test-plans', 'App.xctestplan', '{"testTargets":"invalid"}'],
    ['xcode/test-plans', 'App.xctestplan', '{"testTargets":[{"target":{"name":1}}]}'],
    ['xcode/xcstrings', 'Localizable.xcstrings', 'null'],
    ['xcode/xcstrings', 'Localizable.xcstrings', '{"strings":{"title":null}}'],
    ['xcode/xcstrings', 'Localizable.xcstrings', '{"strings":{"title":{"localizations":[]}}}'],
    ['xcode/assets', 'Assets.xcassets/Logo.imageset/Contents.json', '{"images":"invalid"}'],
    ['xcode/assets', 'Assets.xcassets/Logo.imageset/Contents.json', '{"images":[{"filename":1}]}'],
] as const;
