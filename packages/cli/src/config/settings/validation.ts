import type { Check } from '#cli/types/manifests.ts';

export const GLOB_BRACKETS = /[()[\]]/u;

export const FIRST_READ: readonly string[] = [
    'general/engineering/rules/WORKING.md',
    'general/prose/rules/WRITING.md',
    'general/engineering/rules/TALKING.md',
];

export const CATEGORY_PARENTS: Readonly<Record<string, string>> = {
    classes: 'types',
    type_aliases: 'types',
    exceptions: 'types',
    methods: 'functions',
    constants: 'variables',
    attributes: 'properties',
    enum_cases: 'properties',
    modules: 'files',
    packages: 'folders',
};

export const SETTING_NAME_PLACEHOLDER = '<name>';

export const OVERRIDING_GROUPS = new Set<string>(['framework', 'platform', 'library', 'database']);

export const OPENNEXT_PACKAGE = '@opennextjs/cloudflare';

export const OPENNEXT_TYPE_DEFAULTS = {
    'cloudflare.types_file': 'cloudflare-env.d.ts',
    'cloudflare.types_interface': 'CloudflareEnv',
} as const;

export const BUILD_SCRIPT = ['run', 'build'] as const;

export const NO_CHECK_PATHS_MESSAGE = 'An ignore without check needs paths.';

export const NO_SETTINGS_MESSAGE = 'There is no gspot.toml here. Run gspot init to create one.';

export const SETTINGS_ENCODING_MESSAGE = 'gspot.toml must contain valid UTF-8 text.';

export const TOML_FORMAT = { inlineTableStart: 1, bracketSpacing: false, trailingComma: false } as const;

export const SETTINGS_PREFACE = /^(?:# Change these settings[^\n]*\n)?/u;

export const OWN_FILES_ONLY = 'only its own files';

export const CATEGORY_KEY_SEGMENTS = 2;

export const COMMAND_CHECK_DEFAULTS = {
    level: 'basic',
    runs: 'files',
    files: {
        extensions: [],
        filenames: [],
        tags: [],
        languages: false,
        prettier_plugins: false,
        eslint_plugins: false,
        kinds: ['source', 'generated'],
    },
} satisfies Pick<Check, 'level' | 'runs'> & {
    files: Omit<NonNullable<Check['files']>, 'paths'>;
};

export const COMMAND_CHECK_WHY = 'This repository runs this command as one of its checks.';

export const COMMAND_CHECK_HELP = 'Read the command output; this repository declares the check.';

export const NO_ROOT_SCOPE_MESSAGE = 'The scopes hold no repository root.';

export const ROOT_KEYS = [
    'level',
    'configurations',
    'removed_configurations',
    'test_files',
    'tool_timeout_seconds',
] as const;

export const REMOVED_CONFIGURATIONS = 'removed_configurations';

export const FIRST_TABLES = [
    'hooks',
    'ci',
    'rule_files',
    'format',
    'limits',
    'naming',
    'structure',
    'dependencies',
    'docs',
    'licenses',
    'spelling',
] as const;

export const LAST_TABLES = ['tools', 'scope', 'import_rule', 'command_check', 'ignore'] as const;

export const AT_TOP_LEVEL = 'at the top level';

export const UNDER_TABLE = 'under that table';

export const REASON_WORDS_MIN = 2;

export const ADD_REASON_MESSAGE = 'Add reason = "..." to this record.';

export const EMPTY_REASON = 'an empty reason';

export const REMOVAL_REASON_SUGGESTION = 'Run gspot remove <configuration> --reason "<why>".';

export const RECORD_PATHS_MESSAGE = ' Its paths say where it applies.';

export const SETTING_RULES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
    eslint: {
        'gspot/no-identical-functions': 'duplication.min_lines',
        'no-restricted-imports': 'javascript.banned_imports',
        'gspot/import-boundaries': 'javascript.import_boundaries',
        'gspot/no-trivial-files': 'structure.reexports',
        'n/file-extension-in-import': 'javascript.import_extension',
    },
};

export const COVERAGE_LINES_SETTING = 'coverage.min_line_percent';

export const SWIFT_TARGET_MESSAGE =
    'A Swift target with a lower line minimum than coverage.min_line_percent needs a reason.';

export const TRAILING_PERIOD = /\.$/u;
