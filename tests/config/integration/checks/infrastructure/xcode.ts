export const XCODE_SANDBOX = {
    install: false,
    configurations: ['xcode'],
    files: {},
} as const;

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

export const PLUTIL_UNREADABLE_FILES = [
    {
        path: 'missing.plist',
        reason: 'The file \u201Cmissing.plist\u201D couldn\u2019t be opened because there is no such file.',
    },
    {
        path: 'private.plist',
        reason: 'The file \u201Cprivate.plist\u201D couldn\u2019t be opened because you don\u2019t have permission to view it.',
    },
] as const;
