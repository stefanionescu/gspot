import { QUIET_INIT } from '#tests/config/harness/init.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/config/samples/bash.ts';
import type { FindingCase } from '#tests/types/harness/check-case.ts';
import type { RepositoryScenario } from '#tests/types/harness/repository.ts';

export const CONFIGS_INIT = [
    'init',
    '--yes',
    '--configurations',
    'files',
    '--no-task',
    '--no-ci',
    '--no-rules',
    '--no-install',
];

/** Authored inputs and configuration selection for this scenario. */
export const REPOSITORY: RepositoryScenario = {
    configurations: ['files'],
    modules: false,

    init: [...QUIET_INIT],
    tools: ['taplo', 'yamllint', 'dotenv-linter'],
    files: { 'scripts/a.sh': CLEAN_BASH_SCRIPT, 'settings/clean.toml': 'a = 1\n' },
};

/** Defects, expected findings, and explicit corrections. */
export const CASES: FindingCase[] = [
    {
        check: 'files/taplo-format',
        files: { 'settings/layout.toml': 'a    =     1\nb=2\n' },
        expected: {
            file: 'settings/layout.toml',
            message: 'The file is not formatted with the configured TOML settings.',
        },
        corrected: { files: { 'settings/layout.toml': 'a = 1\nb = 2\n' } },
    },
    {
        check: 'files/dotenv-linter',
        files: { '.env.example': 'PORT=3000\nport=3000\nPORT=4000\n' },
        expected: { file: '.env.example', rule: 'LowercaseKey', line: 2 },
        corrected: { files: { '.env.example': 'PORT=3000\n' } },
    },
    {
        check: 'files/xmllint',
        files: { 'settings/feed.xml': '<feed><entry></feed>\n' },
        expected: {
            file: 'settings/feed.xml',
            line: 1,
            message: 'parser error : Opening and ending tag mismatch: entry line 1 and feed',
        },
        corrected: { files: { 'settings/feed.xml': '<feed><entry /></feed>\n' } },
    },
    // The plist reader is the macOS plutil.
    {
        check: 'files/plutil',
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
