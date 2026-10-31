import { dirname } from 'node:path';
import { GSPOT_PATHS } from '#cli/config/files/gspot.ts';

export const UNQUOTED_FINDING_PREFIX = '  scripts/b.sh:2:6  SC2086  ';

export const UNQUOTED_SCRIPT = '#!/usr/bin/env bash\necho $1\n';

export const HOOKS_OFF_SETTINGS = '[hooks]\nenabled = false\n';

export const PACKAGE_MANAGER_AGE_REFUSALS = {
    npm: { version: '11.18.0', minimum: '11.19.0' },
    bun: { version: '1.2.22', minimum: '1.3.0' },
    pnpm: { version: '10.15.0', minimum: '10.16.0' },
} as const;

export const PYTHON_INDEX_CREDENTIALS = { user: 'gspot', password: 'synthetic-uv-password' } as const;

export const UV_RELEASE_CUTOFF_LINE = /^exclude-newer = .*$/mu;

export const PYTHON_PROJECTS = ['uv.toml', 'pyproject.toml'] as const;

export const ZIP_FILE_OPTIONS = {
    regular: { os: 3, attrs: 0o10_0644 * 0x1_00_00 },
    executable: { os: 3, attrs: 0o10_0755 * 0x1_00_00 },
} as const;

export const AUTHORED_STYLE_PATH = `${dirname(GSPOT_PATHS.valeConfig)}/styles/Google/legacy.yml`;

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
