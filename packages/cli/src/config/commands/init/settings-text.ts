import { SETTINGS_COMMANDS } from '#cli/config/generation/rules.ts';

export const OPENAPI_CONFIGURATION = 'openapi';

/** Each SDK root picks its xcodebuild destination during init. */
export const XCODE_DESTINATIONS = new Map<string | undefined, string>([
    ['iphoneos', 'generic/platform=iOS Simulator'],
    ['iphonesimulator', 'generic/platform=iOS Simulator'],
    ['macosx', 'platform=macOS'],
    ['watchos', 'generic/platform=watchOS Simulator'],
    ['watchsimulator', 'generic/platform=watchOS Simulator'],
    ['xros', 'generic/platform=visionOS Simulator'],
    ['xrsimulator', 'generic/platform=visionOS Simulator'],
]);

export const PREFACE_BODY = `# gspot settings for this repository. Change them with gspot ${new Intl.ListFormat('en', { type: 'conjunction' }).format(SETTINGS_COMMANDS)}.\n\n`;
