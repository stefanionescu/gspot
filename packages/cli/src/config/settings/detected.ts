export const BUILD_SCRIPT = ['run', 'build'] as const;

export const OPENNEXT_PACKAGE = '@opennextjs/cloudflare';

export const OPENNEXT_TYPE_DEFAULTS = {
    types_file: 'cloudflare-env.d.ts',
    types_interface: 'CloudflareEnv',
} as const;

export const BUNDLER_PACKAGES: ReadonlySet<string> = new Set([
    'esbuild',
    'vite',
    'webpack',
    'rollup',
    'rolldown',
    '@rspack/core',
]);

export const IMPORT_EXTENSION_SETTING = 'javascript.import_extension';

export const XCODE_DESTINATIONS = new Map<string | undefined, string>([
    ['iphoneos', 'generic/platform=iOS Simulator'],
    ['iphonesimulator', 'generic/platform=iOS Simulator'],
    ['macosx', 'platform=macOS'],
    ['watchos', 'generic/platform=watchOS Simulator'],
    ['watchsimulator', 'generic/platform=watchOS Simulator'],
    ['xros', 'generic/platform=visionOS Simulator'],
    ['xrsimulator', 'generic/platform=visionOS Simulator'],
]);

export const CLOUDFLARE_CONFIGURATION = 'cloudflare';

export const JAVASCRIPT_CONFIGURATION = 'javascript';

export const OPENAPI_CONFIGURATION = 'openapi';

export const SITE_CONFIGURATION = 'site';

export const SWIFT_CONFIGURATION = 'swift';
