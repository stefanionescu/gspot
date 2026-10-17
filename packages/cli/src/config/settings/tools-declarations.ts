export const TOOLS_DECLARATIONS = {
    'tools.eslint.override.paths': { description: 'The files that these lint rule options apply to.' },
    'tools.eslint.override.rules': { description: 'Lint rule options for these files.' },
    'tools.eslint.override.runtime': {
        description: 'The runtime of these files, such as `serviceworker` (the name the `globals` package uses).',
    },
    'tools.v8r.schema.paths': { description: 'Files SchemaStore does not know.' },
    'tools.v8r.schema.url': { description: 'The JSON Schema for them.' },
    'tools.eslint.import_extension': {
        configurations: ['javascript'],
        description:
            'The import suffix in this scope: js for compiled ESM, ts for Deno and Bun, or extensionless for code that a bundler builds.',
    },
    'tools.eslint.restricted_imports': {
        configurations: ['javascript'],
        description: 'Imports that this repository refuses, each with a name and a message.',
    },
    'tools.eslint.rules': {
        configurations: ['javascript'],
        description:
            'Option arrays by ESLint rule ID, without a severity, which apply only where the level turns the rule on; accept findings with gspot ignore --rule.',
    },
    'tools.eslint.override': {
        configurations: ['javascript'],
        description: 'Lint rule options for repository-relative paths, in order, with ignores applied last.',
    },
    'tools.hadolint.trusted_registries': {
        configurations: ['docker'],
        description: 'The registries a base image may come from; empty allows any.',
    },
    'tools.nginx.image': {
        configurations: ['nginx'],
        description: 'The image nginx -t runs in; name the one the deployment uses.',
    },
    'tools.ruff.docstring_convention': {
        configurations: ['python'],
        description:
            'The Ruff pydocstyle convention from the project settings, which pydoclint also uses when it has no style of its own.',
    },
    'tools.semgrep.registry_packs': {
        configurations: ['security'],
        description: 'The registry packs the manual registry check runs.',
    },
    'tools.semgrep.rule_files': {
        configurations: ['security'],
        description: 'Rule files or folders of the repository that Semgrep runs beside the shipped packs.',
    },
    'tools.sqlfluff.dialect': {
        configurations: ['sql'],
        description: 'The sqlfluff dialect; a database configuration sets it.',
    },
    'tools.swiftlint.always_keep_imports': {
        configurations: ['swift'],
        description: 'Imports the analyzer keeps although it sees no use of them.',
    },
    'tools.trivy.severity': {
        configurations: ['docker'],
        description: 'The severities Trivy reports.',
    },
    'tools.commitlint.types': {
        configurations: ['commits'],
        description: 'The commit types the type-enum rule allows.',
    },
    'tools.commitlint.scopes': {
        configurations: ['commits'],
        description:
            'Commit scopes that the scope-enum rule accepts, and a message may leave out its scope. When empty, gspot uses the last segment of each project scope path, or no list without project scopes.',
    },
    'tools.commitlint.rules': {
        configurations: ['commits'],
        description:
            'Options for active commitlint rules, by rule name: an always/never condition and an optional value, without a severity; the level decides which rules run. Ignore a finding with gspot ignore commits/commitlint --rule `<rule>` --reason `<why>`.',
        off_values: [0],
    },
    'tools.yamllint.rules': {
        configurations: ['files'],
        description:
            'Option tables for active YAML rules; the level decides which rules run, and [format] sets the width. Ignore a finding with gspot ignore files/yamllint --rule `<rule>` --reason `<why>`.',
        off_values: ['disable'],
    },
    'tools.markdownlint.rules': {
        configurations: ['markdown'],
        description:
            'Option tables by Markdown rule ID, such as MD024; the level decides which rules run. Ignore a finding with gspot ignore markdown/markdownlint --rule `<rule>` --reason `<why>`.',
        off_values: [false],
    },
    'tools.stylelint.rules': {
        configurations: ['css'],
        description:
            'Options for the Stylelint rules that run at the level, which stay errors. Accept a finding with gspot ignore css/stylelint --rule `<rule>` --reason `<why>`.',
    },
    'tools.squawk.assume_in_transaction': {
        configurations: ['postgres'],
        description:
            'Whether the migration runner wraps every migration in a transaction; the supabase configuration turns it on.',
    },
    'tools.knip.entry': {
        configurations: ['javascript'],
        description: 'Entry points knip starts from beyond the ones the framework configuration declares.',
    },
    'tools.knip.ignore_dependencies': {
        configurations: ['javascript'],
        description:
            'Exact package names that knip does not report as unused; new names need a reason, and a scope list applies to that project only.',
        reason_needed: 'adding',
    },
    'tools.purgecss.safelist': {
        configurations: ['site'],
        description: 'Class names a script adds at run time: the names and the reason.',
        reason_needed: 'adding',
    },
    'tools.v8r.schema': {
        configurations: ['files'],
        description: 'File patterns mapped to schema URLs, for files that the SchemaStore catalog does not know.',
    },
} as const;
