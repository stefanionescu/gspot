// cloudflare types

export const OPENNEXT_PACKAGE = '@opennextjs/cloudflare';
export const OPENNEXT_TYPE_DEFAULTS = {
    types_file: 'cloudflare-env.d.ts',
    types_interface: 'CloudflareEnv',
} as const;

// configuration names
export const ASTRO_CONFIGURATION = 'astro';
export const CLOUDFLARE_CONFIGURATION = 'cloudflare';
export const FASTAPI_CONFIGURATION = 'fastapi';
export const FORMAT_CONFIGURATION = 'format';
export const JAVASCRIPT_CONFIGURATION = 'javascript';
export const NESTJS_CONFIGURATION = 'nestjs';
export const NEXTJS_CONFIGURATION = 'nextjs';
export const OPENAPI_CONFIGURATION = 'openapi';
export const PYTHON_CONFIGURATION = 'python';
export const REACT_NATIVE_CONFIGURATION = 'react-native';
export const SITE_CONFIGURATION = 'site';
export const SWIFT_CONFIGURATION = 'swift';
export const TRANSLATIONS_CONFIGURATION = 'translations';
export const TRPC_CONFIGURATION = 'trpc';
export const TYPESCRIPT_CONFIGURATION = 'typescript';

// javascript imports
export const BUNDLER_PACKAGES: ReadonlySet<string> = new Set([
    'esbuild',
    'vite',
    'webpack',
    'rollup',
    'rolldown',
    '@rspack/core',
]);
export const IMPORT_EXTENSION_SETTING = 'javascript.import_extension';
export const TS_SUFFIX_IMPORT = /(?:\bfrom|\bimport)\s*(?:\(\s*)?["']\.{1,2}\/[^"']*\.[cm]?tsx?["']/u;

// translation message files
export const MESSAGES_FOLDER = 'messages';
export const MESSAGE_FILE_SUFFIX = '.json';

// xcode destination
export const XCODE_DESTINATIONS = new Map<string | undefined, string>([
    ['iphoneos', 'generic/platform=iOS Simulator'],
    ['iphonesimulator', 'generic/platform=iOS Simulator'],
    ['macosx', 'platform=macOS'],
    ['watchos', 'generic/platform=watchOS Simulator'],
    ['watchsimulator', 'generic/platform=watchOS Simulator'],
    ['xros', 'generic/platform=visionOS Simulator'],
    ['xrsimulator', 'generic/platform=visionOS Simulator'],
]);
