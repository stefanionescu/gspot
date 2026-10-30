import { dirname } from 'node:path';
import { GSPOT_PATHS } from '#cli/config/files/gspot.ts';

export const AUTHORED_STYLE_PATH = `${dirname(GSPOT_PATHS.valeConfigFile)}/styles/Google/legacy.yml`;

export const AUTHORED_VALE_FILES = {
    files: { 'authored.txt': 'keep\n', [AUTHORED_STYLE_PATH]: 'authored legacy bytes\n' },
} as const;

export const GOOGLE_RULE_PATH = `${GSPOT_PATHS.valePackages}/Google/Passive.yml`;

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

export const AUTHORED_STYLE = 'authored legacy bytes\n';
