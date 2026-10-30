export const XCODE_CASES = [
    {
        check: 'xcode/plutil',
        files: { 'app/Info.plist': '<plist><dict><key>A</key></plist>\n' },
        expected: { file: 'app/Info.plist' },
        corrected: {
            files: {
                'app/Info.plist':
                    '<?xml version="1.0"?><plist version="1.0"><dict><key>A</key><string>value</string></dict></plist>\n',
            },
        },
    },
] as const;

export const PLUTIL_UNREADABLE_FILES = ['missing.plist', 'private.plist'] as const;
