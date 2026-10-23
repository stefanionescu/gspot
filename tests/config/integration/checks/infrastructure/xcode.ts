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

/** A file that plutil cannot read, and the reason it prints for it. */
export const PLUTIL_UNREADABLE_FILES = [
    {
        path: 'missing.plist',
        reason: 'The file “missing.plist” couldn’t be opened because there is no such file.',
    },
    {
        path: 'private.plist',
        reason: 'The file “private.plist” couldn’t be opened because you don’t have permission to view it.',
    },
] as const;
