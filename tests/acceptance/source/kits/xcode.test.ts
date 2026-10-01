// Planted repository for the xcode configuration: a plist that does not parse.
import { commitAll } from '#tests/support/cli/git.ts';
import { onMac } from '#tests/support/cli/platforms.ts';
import { plantedCases } from '#tests/support/cli/planted.ts';
import { HOME, PLAN, IMAGES, XCODE_PROJECT } from '#tests/inputs/acceptance/source/kits/kits.ts';

const PLIST_HEAD = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "https://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n<dict>\n`;
const PLIST_TAIL = '</dict>\n</plist>\n';

// The plist check needs plutil, which only macOS has, so no other system installs the project.
if (onMac)
    plantedCases(
        'the xcode configuration',
        {
            kits: ['xcode'],
            modules: false,
            without: ['spelling', 'swift'],
            tools: ['taplo', 'yamllint'],
            files: {
                'App.xcodeproj/project.pbxproj': XCODE_PROJECT,
                'App.xcodeproj/xcshareddata/xcschemes/App.xcscheme':
                    '<Scheme>\n    <TestAction>\n        <TestPlans><TestPlanReference reference="container:App.xctestplan"/></TestPlans>\n    </TestAction>\n</Scheme>\n',
                'App.xctestplan': PLAN,
                'App/Home.swift': HOME,
                'App/Info.plist': `${PLIST_HEAD}    <key>CFBundleName</key>\n    <string>App</string>\n${PLIST_TAIL}`,
                'App/Base.xcconfig': '// The base settings.\nSWIFT_VERSION = 5.9\n#include "Shared.xcconfig"\n',
                'App/Shared.xcconfig': 'OTHER[sdk=iphoneos*] = value\n',
                'App/Localizable.xcstrings': `{\n    "sourceLanguage": "en",\n    "strings": {\n        "hello": { "localizations": { "de": {}, "en": {} } },\n        "bye": { "localizations": { "de": {}, "en": {} } }\n    },\n    "version": "1.0"\n}\n`,
                'App/Assets.xcassets/Contents.json': '{\n    "info": { "author": "xcode", "version": 1 }\n}\n',
                'App/Assets.xcassets/Logo.imageset/Contents.json': IMAGES,
                'App/Assets.xcassets/Logo.imageset/logo.png': 'png',
            },
            prepare: commitAll,
        },
        [
            {
                check: 'xcode/plist',
                files: { 'App/Info.plist': '<plist><dict><key>broken</dict></plist>\n' },
                expected: { file: 'App/Info.plist' },
            },
        ],
    );
