import { DOCS_PATHS } from '#cli/config/manifests.ts';

export const SCHEMA_TYPE_LABELS: Readonly<Record<string, string>> = {
    string: 'Text',
    integer: 'Whole number',
    number: 'Number',
    boolean: '`true` or `false`',
    array: 'List',
    object: 'Table',
};

export const CHECK_RUN_LABELS = {
    once: 'once for the repository',
    scope: 'once per scope',
    files: 'per file',
    history: 'once for pushed history',
} as const;

export const CHECK_NEEDS_LABELS = {
    build: 'a build of the project',
    dependencies: 'the installed npm dependencies of the project',
    docker: 'Docker, running',
    network: 'network access',
    'python-environment': 'the Python environment of the project',
} as const;

export const LEVEL_ADVICE = {
    basic: 'Choose it for an existing codebase or a first run, where a false positive costs the most.',
    all: 'Choose it for a new repository or one that coding agents write, where the code can follow the taste rules from the start.',
} as const;

export const REFERENCE_PATH = new URL(DOCS_PATHS.reference).pathname;

export const REFERENCE_FOLDERS = Object.fromEntries(
    ['commands', 'settings', 'jsonOutput', 'configurations', 'checks', 'eslintPlugin'].map((name) => [
        name,
        new URL(DOCS_PATHS[name as keyof typeof DOCS_PATHS]).pathname.slice(REFERENCE_PATH.length, -1),
    ]),
) as Record<'commands' | 'settings' | 'jsonOutput' | 'configurations' | 'checks' | 'eslintPlugin', string>;

export const SECTION_HEADING = /^## /mu;

export const LISTED_VALUES_LIMIT = 12;

export const SUPPRESSIONS_CHECK = 'gspot/suppressions';

export const NAME_PLACEHOLDER = '<name>';

export const ANGLE_BRACKETS = /[<>]/gu;

export const TABLE_HEADING_LEVEL = 2;

export const REASONED_VALUE_LABEL = 'a reasoned value `{ value = …, reason = "…" }`';

export const LANGUAGE_PLACEHOLDER = '<language>';

export const CATEGORY_PLACEHOLDER = '<category>';

export const ENVIRONMENT_VARIABLES: ReadonlyArray<[name: string, meaning: string]> = [
    ['`NO_COLOR`', 'Any nonempty value turns color off.'],
    ['`XDG_CACHE_HOME`, `LOCALAPPDATA`', 'The cache folder; it must be an absolute path.'],
];

export const CONJUNCTION_FORMAT = new Intl.ListFormat('en', { type: 'conjunction' });

export const DISJUNCTION_FORMAT = new Intl.ListFormat('en', { type: 'disjunction' });

export const CHECKS_OPENING =
    'Each check ID is `<configuration>/<name>`. The [stage](' +
    DOCS_PATHS.stage +
    ') says when it runs, and the ' +
    '[level](' +
    DOCS_PATHS.levels +
    ') says which setting of `level` turns it on. ' +
    '`gspot explain <check>` shows its state in your repository.\n';

export const PURPOSE_HEADING = 'What it does';

export const BUILT_IN_MESSAGE = 'gspot runs this check itself.';

export const CHECK_FIX_MESSAGE = '`gspot check --fix` fixes what it can.';

export const REFUSED_SUPPRESSION_MESSAGE = '\n\nA suppression comment is refused; use `gspot ignore`.';

export const LINT_RULES_MESSAGE = ', or one of its lint rules';

export const HELP_HEADING = 'What to do';

export const TURN_OFF_HEADING = 'Turn it off';

export const SUPPRESSION_FORMS_HEADING = 'Suppression forms';

export const REFUSED_FORM_LABEL = 'Refused; use `gspot ignore`';

export const DEFINITION_HEADING = 'What it is';

export const EXIT_CODE_HEADING = 'Exit code';

export const EXAMPLE_MESSAGE = 'For example:';

export const COMMANDS_DESCRIPTION = 'Every gspot command, its options, and its exit codes.';

export const GLOBAL_OPTIONS_HEADING = 'Global options';

export const EXIT_CODES_HEADING = 'Exit codes';

export const ENVIRONMENT_VARIABLES_HEADING = 'Environment variables';

export const SETS_HEADING = 'What it sets';

export const SELECTED_HEADING = 'Selected when';

export const RULES_OFF_HEADING = 'Lint rules turned off';

export const DEFAULTS_HEADING = 'Defaults set for other configurations';

export const RULE_FILES_HEADING = 'Rules for coding agents';

export const CONFIGURATIONS_DESCRIPTION = 'Choose configurations by the files and tools they check.';

export const CONFIGURATIONS_OPENING =
    'gspot selects configurations from the files of each scope. `gspot add <name>` and ' +
    '`gspot remove <name>` change the selection, and `gspot list` shows it.\n';

export const CHECKS_HEADING = 'What it checks';

export const RULE_FILE_HEADING = 'Rule file';

export const INSTALLED_HEADING = 'Installed when';

export const ALL_FILES_LABEL = 'All files in the scope';

export const LINT_RULES_HEADING = 'Lint rules';

export const ALWAYS_SELECTED_MESSAGE = 'Always selected.';

export const CONDITION_SEPARATOR = ', or ';

export const SELF_INSTALL_LABEL = ', install it yourself';

export const TOOLS_VERSIONS_HEADING = 'Tools and versions';

export const CONFIG_FILES_HEADING = 'Files gspot writes';

export const IGNORED_PATHS_HEADING = 'Kept out of Git';

export const DEFAULT_OPTION_DESCRIPTION = 'See the example.';

export const NO_OPTIONS_MESSAGE = 'This rule has no options.';

export const NO_CONFIG_MESSAGE = 'No config turns it on; turn it on in your ESLint config.';

export const ESLINT_FIX_MESSAGE = ' `eslint --fix` fixes it.';

export const BANNED_NAME_MESSAGE =
    'See [Accept a banned name](/configure/gspot-toml/#accept-a-banned-name) for an exact-name override.\n\n';

export const MONOREPOS_SCOPE_MESSAGE = 'See [Monorepos](/configure/monorepos/) for how a scope inherits settings.\n\n';

export const SETTINGS_DESCRIPTION = 'Every key, accepted value, and default of gspot.toml.';

export const SETTINGS_OPENING =
    'Every key of `gspot.toml`, its accepted values, and its default. See [gspot.toml](/configure/gspot-toml/) to change them.\n\n';

export const TOP_LEVEL_HEADING = 'Top-level keys';

export const SENTENCE_END = /[.\n]$/u;

export const COMMANDS_OPENING = `Run gspot from any folder of the repository; it uses the \`gspot.toml\` at the top of the Git repository. Start each command the way your repository runs gspot, such as \`bunx --no-install gspot\` or \`mise exec -- gspot\`. See [Installation](/start/install/#choose-how-to-install). Commands that change settings write generated files too.\n\n`;

export const SUBSECTION_HEADING_LEVEL = 3;

export const MINOR_HEADING_LEVEL = 4;

export const DOCS_SOURCE_NAME = 'gspot-docs';
export const REFERENCE_IDS_KEY = 'reference-ids';
export const PAGES_FOLDER = 'src/content/docs';
export const REFERENCE_CODE_FENCE = /^ {0,3}(`{3,}|~{3,})[^\n]*\n?/gmu;
export const REFERENCE_FENCE_END = /^(?:`+|~+)$/u;
export const REFERENCE_INLINE_TOKENS = /(?<delimiter>`+)|(?<flag>(?<![\w-])--[a-z][a-z-]*)|[&<>|]/gu;
export const REFERENCE_TEXT_ENTITIES: Readonly<Record<string, string>> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '|': '&#124;',
};

export const REFERENCE_CODE_CHARACTERS = /[&<>|[\]*_~`\\"'-]/gu;
export const REFERENCE_CODE_ENTITIES: Readonly<Record<string, string>> = {
    ...REFERENCE_TEXT_ENTITIES,
    '[': '&#91;',
    ']': '&#93;',
    '*': '&#42;',
    _: '&#95;',
    '~': '&#126;',
    '`': '&#96;',
    '\\': '&#92;',
    '"': '&#34;',
    "'": '&#39;',
    '-': '&#45;',
};

export const RELEASE_AGE_EXCLUSIONS = [
    { label: 'pnpm', key: 'minimumReleaseAgeExclude', file: 'pnpm-workspace.yaml' },
    { label: 'Bun', key: 'install.minimumReleaseAgeExcludes', file: 'bunfig.toml' },
    { label: 'npm', key: 'min-release-age-exclude', file: '.npmrc' },
    { label: 'Yarn', key: 'npmPreapprovedPackages', file: '.yarnrc.yml' },
] as const;

export const CURL_COMMAND = 'curl -fsSL';
