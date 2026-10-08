export const CONFIGURATIONS = [
    'typescript',
    'javascript',
    'react',
    'nextjs',
    'css',
    'html',
    'markdown',
    'prose',
    'spelling',
    'commits',
    'files',
    'naming',
    'format',
    'docs',
    'secrets',
    'dependencies',
    'licenses',
];

export const SDK_DESTINATIONS = [
    { sdk: 'iphoneos', destination: 'generic/platform=iOS Simulator' },
    { sdk: 'iphonesimulator', destination: 'generic/platform=iOS Simulator' },
    { sdk: 'macosx', destination: 'platform=macOS' },
    { sdk: 'watchos', destination: 'generic/platform=watchOS Simulator' },
    { sdk: 'watchsimulator', destination: 'generic/platform=watchOS Simulator' },
    { sdk: 'xros', destination: 'generic/platform=visionOS Simulator' },
    { sdk: 'xrsimulator', destination: 'generic/platform=visionOS Simulator' },
];

export const MANUAL_SWIFT_CHOICES = [
    { name: 'disabled project', swift: { xcode_project: '' }, destination: 'generic/platform=iOS Simulator' },
    { name: 'selected project', swift: { xcode_project: 'Chosen.xcodeproj' }, destination: 'platform=macOS' },
    { name: 'empty destination', swift: { xcode_project: 'Chosen.xcodeproj', xcode_destination: '' }, destination: '' },
    {
        name: 'manual destination',
        swift: { xcode_project: 'Chosen.xcodeproj', xcode_destination: 'custom destination' },
        destination: 'custom destination',
    },
];
