import type { SettingDefinition } from '#cli/types/settings/definitions.ts';

export const TOOL_SETTING_DEFINITIONS = {
    'tools.eslint.override.paths': {
        description: 'The files that these lint rule options apply to.',
    },
    'tools.eslint.override.rules': { description: 'Lint rule options for these files.' },
    'tools.eslint.override.runtime': {
        description: 'The runtime of these files, such as `serviceworker` (the name the `globals` package uses).',
    },
    'tools.v8r.schema.paths': {
        description: 'Files SchemaStore does not know.',
    },
    'tools.v8r.schema.url': { description: 'The JSON Schema for them.' },
    'tools.eslint.import_extension': {
        template: 'repository',
        configurations: ['javascript'],
        description:
            'The import suffix in this scope: js for compiled ESM, ts for Deno and Bun, or extensionless for code that a bundler builds.',
        default: 'js',
    },
    'tools.eslint.restricted_imports': {
        configurations: ['javascript'],
        description: 'Imports that this repository refuses, each with a name and a message.',
        default: [] as [],
    },
    'tools.eslint.rules': {
        configurations: ['javascript'],
        description:
            'Option arrays by ESLint rule ID, without a severity, for rules that the level runs; gspot refuses options for any other rule. Accept a finding with gspot ignore javascript/eslint --rule `<rule>` --reason `<why>`.',
        default: {},
    },
    'tools.eslint.plugins': {
        configurations: ['javascript'],
        description:
            'Your own ESLint plugins: a rule prefix as name, a tracked .js or .mjs module as path, and the rules that turn on as errors.',
        default: [] as [],
    },
    'tools.eslint.override': {
        configurations: ['javascript'],
        description: 'Lint rule options for repository-relative paths, in order, with ignores applied last.',
        default: [] as [],
    },
    'tools.hadolint.trusted_registries': {
        configurations: ['docker'],
        description: 'The registries a base image may come from; empty allows any.',
        default: [] as [],
    },
    'tools.nginx.image': {
        template: 'code',
        configurations: ['nginx'],
        description: 'The image nginx -t runs in; name the one the deployment uses.',
        default: 'nginx:1.29.3-alpine',
    },
    'tools.ruff.docstring_convention': {
        configurations: ['python'],
        description: 'The docstring style that Ruff and pydoclint check: google, numpy, or pep257.',
    },
    'tools.semgrep.registry_packs': {
        configurations: ['security'],
        description: 'The registry packs the manual registry check runs.',
        default: [] as [],
    },
    'tools.semgrep.rule_files': {
        configurations: ['security'],
        description: 'Rule files or folders of the repository that Semgrep runs beside the shipped packs.',
        default: [] as [],
    },
    'tools.sqlfluff.dialect': {
        template: 'repository',
        configurations: ['sql'],
        description: 'The SQL dialect that SQLFluff parses, such as postgres. The postgres configuration sets it.',
        default: 'ansi',
    },
    'tools.swiftlint.always_keep_imports': {
        template: 'repository',
        configurations: ['swift'],
        description: 'Imports the analyzer keeps although it sees no use of them.',
        default: [] as [],
    },
    'tools.trivy.severity': {
        configurations: ['docker'],
        description: 'The severities Trivy reports.',
        default: ['HIGH', 'CRITICAL'] as ['HIGH', 'CRITICAL'],
    },
    'tools.commitlint.types': {
        reason_when: 'adding',
        configurations: ['commits'],
        description: 'The commit types the type-enum rule allows.',
        default: ['feat', 'fix', 'refactor', 'perf', 'docs', 'test', 'build', 'ci', 'chore', 'style', 'revert'] as [
            'feat',
            'fix',
            'refactor',
            'perf',
            'docs',
            'test',
            'build',
            'ci',
            'chore',
            'style',
            'revert',
        ],
    },
    'tools.commitlint.scopes': {
        template: 'repository',
        configurations: ['commits'],
        description:
            'Commit scopes that the scope-enum rule accepts, and a message may leave out its scope. When empty, gspot uses the last segment of each project scope path, or no list without project scopes.',
        default: [] as [],
    },
    'tools.commitlint.rules': {
        configurations: ['commits'],
        description:
            'Options for active commitlint rules, by rule name: an always/never condition and an optional value, without a severity; the level decides which rules run. Accept a finding with gspot ignore commits/commitlint --rule `<rule>` --reason `<why>`.',
        default: {},
    },
    'tools.yamllint.rules': {
        configurations: ['data-files'],
        description:
            'Option tables for active YAML rules; the level decides which rules run, and [format] sets the width. Accept a finding with gspot ignore data-files/yamllint --rule `<rule>` --reason `<why>`.',
        default: {},
    },
    'tools.markdownlint.rules': {
        configurations: ['markdown'],
        description:
            'Option tables by Markdown rule ID, such as MD024; the level decides which rules run. Accept a finding with gspot ignore markdown/markdownlint --rule `<rule>` --reason `<why>`.',
        default: {},
    },
    'tools.stylelint.rules': {
        configurations: ['css'],
        description:
            'Options for the Stylelint rules that run at the level, which stay errors; gspot refuses options for any other rule. Accept a finding with gspot ignore css/stylelint --rule `<rule>` --reason `<why>`.',
        default: {},
    },
    'tools.squawk.assume_in_transaction': {
        template: 'repository',
        configurations: ['postgres'],
        description: 'Whether the migration runner wraps every migration in a transaction.',
        default: true,
    },
    'tools.knip.entry': {
        configurations: ['javascript'],
        description: 'Entry points knip starts from beyond the ones the framework configuration declares.',
        default: [] as [],
    },
    'tools.knip.ignore_dependencies': {
        template: 'repository',
        configurations: ['javascript'],
        description:
            'Exact package names that knip does not report as unused; new names need a reason, and a scope list applies to that project only.',
        reason_when: 'adding',
        default: [] as [],
    },
    'tools.purgecss.safelist': {
        template: 'repository',
        configurations: ['site'],
        description: 'Class names a script adds at run time: the names and the reason.',
        reason_when: 'adding',
        default: [] as [],
    },
    'tools.v8r.schema': {
        configurations: ['data-files'],
        description: 'File patterns mapped to schema URLs, for files that the SchemaStore catalog does not know.',
        default: [] as [],
    },
} as const satisfies Record<string, SettingDefinition>;
