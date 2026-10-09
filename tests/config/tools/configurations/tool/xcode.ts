import type { FindingCase } from '#tests/types/harness/check-case.ts';
import type { InstalledScenario } from '#tests/types/harness/repository.ts';

export const REPOSITORY: InstalledScenario = {
    configurations: ['xcode'],
    tools: [],
    files: {},
};

export const CASES: FindingCase[] = [
    // The plist reader is the macOS plutil.
    {
        check: 'xcode/plutil',
        files: { 'app/Info.plist': '<plist><dict><key>A</key></plist>\n' },
        expected: { file: 'app/Info.plist' },
        platforms: ['darwin'],
        corrected: {
            files: {
                'app/Info.plist':
                    '<?xml version="1.0"?><plist version="1.0"><dict><key>A</key><string>value</string></dict></plist>\n',
            },
        },
    },
];
