export const DEFAULT_QUOTES = { prettier: 'single', ruff: 'double' } as const;

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

export const BUILD_SCRIPT = ['run', 'build'] as const;

export const OPENNEXT_PACKAGE = '@opennextjs/cloudflare';

/** The types file and interface that the OpenNext guide passes to wrangler types. */
export const OPENNEXT_TYPE_DEFAULTS = {
    'cloudflare.types_file': 'cloudflare-env.d.ts',
    'cloudflare.types_interface': 'CloudflareEnv',
} as const;

/** Settings whose default comes from project files, which the settings writer cannot read. */
export const DETECTED_SETTINGS = [
    'site.build_command',
    'swift.xcode_destination',
    'cloudflare.types_file',
    'cloudflare.types_interface',
] as const;
