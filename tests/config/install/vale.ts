export const VALE_INSTALL_FAILURES = [
    {
        name: 'timeout',
        fakeArguments: ['--wait'],
        message:
            'sync ran longer than tool_timeout_seconds (1s). Raise it with gspot set tool_timeout_seconds <seconds>.',
        settings: 'tool_timeout_seconds = 1\n',
    },
    {
        name: 'its error',
        fakeArguments: [
            '--stderr',
            'Registry request failed: https://alex:synthetic-password@example.com/styles.zip',
            '--exit',
            '7',
        ],
        message: 'Vale sync failed (exit 7):\nRegistry request failed: https://[redacted]@example.com/styles.zip',
        settings: '',
    },
] as const;

export const VALE_PACKAGES_INI = `StylesPath = ../../../vale\nPackages = Google, write-good, proselint, alex, Harper\n`;
