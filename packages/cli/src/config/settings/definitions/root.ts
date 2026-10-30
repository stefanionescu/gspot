import { CI_PINS } from '#cli/config/generation/ci.ts';
import type { SettingDefinition } from '#cli/types/settings/definitions.ts';

export const LEVEL_SUMMARY =
    "Correctness, security, accessibility, type safety, routine formatting, and the project's own declared checks apply at both levels.";

export const ALL_LEVEL_SUMMARY =
    'Level all adds checks and rules for word choice, architecture, naming, doc comments, declaration order, duplication, API style, and complexity.';

export const ROOT_SETTING_DEFINITIONS = {
    configurations: {
        default: [] as [],
        description:
            'The configurations this repository uses besides the always-selected ones. `gspot init` writes the detected ones here; `gspot add` and `gspot remove` change the list.',
    },
    removed_configurations: {
        default: [] as [],
        reason_when: 'adding',
        description:
            'Configurations you removed, each with the reason why, which detection does not add back; only `gspot add` and `gspot remove` write this table.',
    },
    import_rule: {
        configurations: ['structure'],
        description:
            'Code may import its own files and the files of every import rule listed above it, never below. can_import replaces the rules above with an exact list. When import rules exist, every code file belongs to one, apart from tests, tool settings files, scripts, and generated files.',
        default: [] as [],
    },
    level: {
        description: `${LEVEL_SUMMARY} ${ALL_LEVEL_SUMMARY} No level turns on experimental or preview lint rules.`,
        default: 'basic',
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
        template: 'ci',
        description: 'Whether gspot writes a CI workflow; set it at the root only.',
        default: false,
    },
    'ci.provider': {
        template: 'ci',
        description: 'Which CI service gets the workflow; set it at the root only.',
        default: 'github',
    },
    'ci.setup_command': {
        template: 'code',
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
    'ci.linux_runner': {
        description:
            'The GitHub runner label of the Linux job, such as a larger or self-hosted runner. GitHub only; refused with provider = "gitlab".',
        default: CI_PINS.githubRunners.linux.label,
    },
} as const satisfies Record<string, SettingDefinition>;
