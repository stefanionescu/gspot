import type { SettingDefinition } from '#cli/types/settings/definitions.ts';

export const RECORD_FIELD_DEFINITIONS = {
    'command_check.id': {
        description: 'The check ID that `--only` and `[[ignore]] check` use, which may not match a shipped check.',
    },
    'command_check.outputs': {
        description:
            'The files that the command writes. With outputs, the check runs the command in a copy and reports each output that differs from the committed file.',
    },
    'ignore.check': {
        description:
            'The check whose findings you accept: a shipped check or a command check. Leave it out to keep the paths out of every check.',
    },
    'ignore.rule': { description: 'One lint rule of that check.' },
    'ignore.names': {
        description: 'The function names that the ignore covers, such as a hook that a framework calls.',
    },
    'ignore.paths': { description: 'Where the ignore applies.' },
    'ignore.reason': { description: 'Why you accept the findings.' },
    'format.override.paths': {
        description: 'The files these formatting values apply to.',
    },
    'import_rule.name': { description: 'The name that other import rules use in can_import.' },
    'import_rule.paths': { description: 'The files of the import rule.' },
    'import_rule.can_import': {
        description:
            'Exactly the import rules whose files this rule may import, besides its own. Replaces the rules listed above it.',
    },
    'coverage.swift_target.name': {
        description: 'A Swift target named in the coverage report.',
    },
    'coverage.swift_target.lines': {
        description: 'The least share of lines that the target must cover, in place of `coverage.lines`.',
    },
    'coverage.swift_target.reason': { description: 'Why this target may cover less.' },
    'licenses.allowed_package.name': {
        description:
            'The package name, such as `lightningcss`, or a glob that covers one package built for each platform, such as `@img/sharp-libvips-*`.',
    },
    'licenses.allowed_package.version': {
        description:
            'An exact version, a version range such as `^1.2.0`, or `*`; gspot reports a record that matches no locked package.',
    },
    'licenses.allowed_package.reason': { description: 'Why you accept its license; name the license here.' },
    'site.size_limit.paths': {
        description: 'Built files, such as `docs/dist/_astro/*.js`; the size check runs only when a record exists.',
    },
    'site.size_limit.kilobytes': { description: 'The most they may weigh together, compressed.' },
    'scope.path': { description: 'The folder of the scope; no two records may name the same folder.' },
    'scope.configurations': {
        description: 'Configurations for this folder, on top of the root ones; `gspot add --scope` writes this list.',
        default: [] as [],
    },
    'scope.removed_configurations': {
        reason_needed: 'adding',
        description: 'Configurations removed in this folder; only `gspot add` and `gspot remove` write this list.',
        default: [] as [],
    },
    'scope.test_files': { description: 'More test files for this folder, added to the root list.' },
    'ignore.until': {
        description: 'Report this ignore as expired from this date, in YYYY-MM-DD format (UTC).',
    },
    'command_check.command': {
        description: 'The executable and arguments to run on selected files.',
    },
    'command_check.paths': {
        description: 'The files the check reads, as repository-relative globs.',
    },
    'command_check.stage': {
        description: 'The earliest stage that runs this check.',
    },
    'command_check.help': {
        description: 'Instructions for resolving findings.',
    },
    'command_check.fix': {
        description: 'The executable and arguments that correct findings.',
    },
    'command_check.exit_codes': {
        description:
            'Nonzero statuses that mean findings from command and fix. Other nonzero statuses mean execution failure.',
    },
    'command_check.summary': {
        description: 'A short description shown in check listings.',
    },
    'command_check.output': {
        description: 'The parser and location patterns used to read findings.',
    },
    'tools.eslint.restricted_imports.name': {
        description: 'The import to refuse.',
    },
    'tools.eslint.restricted_imports.message': {
        description: 'What to import instead.',
    },
    'tools.eslint.plugins.name': {
        description: 'The rule prefix, such as local in local/no-legacy-api.',
    },
    'tools.eslint.plugins.path': {
        description: 'The plugin module, relative to the repository root.',
    },
    'tools.eslint.plugins.rules': {
        description: 'The rules of the plugin to turn on, with their options.',
    },
    'naming.override.paths': {
        default: ['**'] as ['**'],
    },
    'naming.override.allow_digits': {
        default: false,
    },
    'naming.override.allow_repeated_words': {
        default: false,
    },
    'licenses.allowed_package': {
        configurations: ['licenses'],
        description: 'Packages accepted under a license outside the list: name, exact version, and reason.',
        default: [] as [],
    },
    'coverage.swift_target': {
        configurations: ['swift'],
        description: 'Line coverage minimums for named Swift targets.',
        default: [] as [],
    },
    'site.size_limit': {
        configurations: ['site'],
        description: 'Size limits: the built paths, and the most kilobytes they may weigh compressed.',
        default: [] as [],
    },
} as const satisfies Record<string, SettingDefinition>;
