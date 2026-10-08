import { QUIET_INIT } from '#tests/config/harness/init.ts';
import type { FindingCase } from '#tests/types/harness/check-case.ts';
import type { InstalledScenario } from '#tests/types/harness/repository.ts';

export const REPOSITORY: InstalledScenario = {
    configurations: ['files'],

    init: [...QUIET_INIT],
    tools: ['taplo', 'yamllint'],
    files: {
        'settings/clean.toml': 'a = 1\n',
        'config.yaml': '---\nkey: 1\n',
        'schema.json': '{"type":"object","properties":{"count":{"type":"integer"}},"required":["count"]}\n',
    },
};

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
];
