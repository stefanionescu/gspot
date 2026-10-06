import { QUIET_INIT } from '#tests/config/harness/init.ts';
import type { FindingCase } from '#tests/types/harness/check-case.ts';
import type { RepositoryScenario } from '#tests/types/harness/repository.ts';

/** Authored inputs and configuration selection for this scenario. */
export const REPOSITORY: RepositoryScenario = {
    configurations: ['files'],
    modules: false,

    init: [...QUIET_INIT],
    tools: ['taplo', 'yamllint'],
    files: {
        'settings/clean.toml': 'a = 1\n',
        'config.yaml': '---\nkey: 1\n',
        'schema.json': '{"type":"object","properties":{"count":{"type":"integer"}},"required":["count"]}\n',
    },
};

/** Defects, expected findings, and explicit corrections. */
export const CASES: FindingCase[] = [
    {
        check: 'files/taplo',
        files: { 'settings.toml': 'a = 1\n[x\n' },
        expected: { file: 'settings.toml', line: 2 },
        corrected: { files: { 'settings.toml': 'a = 1\n' } },
    },
    {
        check: 'files/yamllint',
        files: { 'config.yaml': 'key: 1\nkey: 2\n' },
        expected: { file: 'config.yaml', line: 2, rule: 'key-duplicates' },
        corrected: { files: { 'config.yaml': '---\nkey: 1\n' } },
    },
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
        check: 'files/xmllint',
        files: { 'settings/feed.xml': '<feed><entry></feed>\n' },
        expected: {
            file: 'settings/feed.xml',
            line: 1,
            message: 'tag mismatch',
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
