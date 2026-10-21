import type { SettingMetadata } from '#cli/types/settings/metadata.ts';

export const ROOT_DECLARATIONS = {
    configurations: {
        default: [] as [],
        description:
            'The configurations this repository uses besides the always-selected ones. `gspot init` writes the detected ones here; `gspot add` and `gspot remove` change the list.',
    },
    removed_configurations: {
        default: [] as [],
        reason_needed: 'adding',
        description:
            'Configurations you removed, which detection does not add back; only `gspot add` and `gspot remove` write this list.',
    },
    import_rule: {
        configurations: ['structure'],
        description:
            'Code may import its own files and the files of every import rule listed above it, never below. can_import replaces the rules above with an exact list. When import rules exist, every code file belongs to one, apart from tests, tool settings files, scripts, and generated files.',
        default: [] as [],
    },
    level: {
        description:
            "Correctness, security, accessibility, type safety, routine formatting, and the project's own declared checks apply at both levels." +
            ' ' +
            'Level `all` adds checks and rules for word choice, architecture, naming, doc comments, declaration order, API style, and complexity. No level turns on experimental or preview lint rules.',
        default: 'recommended',
    },
    allowed_words: {
        reason_values: true,
        description: 'Words accepted beyond the shipped spelling list, each with the reason it is a real word.',
        default: {},
    },
    tool_timeout_seconds: {
        description:
            'The time limit in seconds for every tool command, including installation and version reads. Root only.',
        default: 600,
    },
    test_files: {
        description: 'Test files. Linters apply their test rules to these files.',
        default: [
            '**/test/**',
            '**/tests/**',
            '**/__tests__/**',
            '**/*.test.*',
            '**/*.spec.*',
            '**/test_*.py',
            '**/*_test.py',
            '**/conftest.py',
            '**/Tests/**',
            '**/*Tests.swift',
        ] as [
            '**/test/**',
            '**/tests/**',
            '**/__tests__/**',
            '**/*.test.*',
            '**/*.spec.*',
            '**/test_*.py',
            '**/*_test.py',
            '**/conftest.py',
            '**/Tests/**',
            '**/*Tests.swift',
        ],
    },
    'ci.enabled': {
        description: 'Whether gspot writes a CI workflow; set it at the root only.',
        default: false,
    },
    'ci.provider': {
        description: 'Which CI service gets the workflow; set it at the root only.',
        default: 'github',
    },
    'ci.setup_command': {
        description: 'A command CI runs before `gspot install`, in place of the frozen install of each lockfile.',
    },
    'rules.enabled': {
        description: 'Write the rules and the AGENTS.md block.',
        default: true,
    },
    'rules.exclude': {
        description:
            'Rule files or folders under .gspot/configurations/ to leave out, such as .gspot/configurations/general/engineering/rules/PLANNING.md.',
        default: [] as [],
    },
    'hooks.enabled': {
        description: 'Install and run the configured Git hooks.',
        default: false,
    },
    'ci.operating_systems': {
        description: 'The operating systems of the CI jobs. GitHub only; refused with provider = "gitlab".',
        default: ['linux'] as ['linux'],
    },
} as const satisfies Record<string, SettingMetadata>;
