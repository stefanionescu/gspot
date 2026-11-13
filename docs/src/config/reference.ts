import { DOCS_PATHS } from '@gspothq/cli/reference';

// changelog page
export const CHANGELOG_TITLE = '# Changelog\n';

// check pages
export const CHECKS_OPENING = `The [stage](${DOCS_PATHS.stage}) says when a check runs, and the [level](${
    DOCS_PATHS.levels
}) says which setting of \`level\` turns it on. \`gspot explain <check>\` shows its state in your repository.\n`;
export const CHECK_FIX_MESSAGE = '`gspot check --fix` fixes what it can.';
export const CHECK_NEEDS_LABELS = {
    build: 'a build',
    dependencies: 'the installed npm dependencies',
    docker: 'a running Docker daemon',
    network: 'network access',
    'python-environment': 'the Python environment of the project',
} as const;
export const CHECK_RUN_LABELS = {
    once: 'once for the repository',
    scope: 'once per scope',
    files: '',
    history: '',
} as const;
export const COMMENT_BLIND_ARGUMENTS = new Set(['--no-inline-config', 'format']);
export const REFUSED_FORM_LABEL = 'Refused; use `gspot ignore`';
export const REFUSED_SUPPRESSION_MESSAGE = '\n\nA suppression comment is refused; use `gspot ignore`.';
export const SUPPRESSIONS_CHECK = 'gspot/suppressions';
export const SUPPRESSION_FORMS_HEADING = 'Suppression forms';
export const TURN_OFF_HEADING = 'Turn it off';

// command pages
export const COMMANDS_OPENING = `gspot reads the \`gspot.toml\` at the top of the Git repository, so you can run it from any folder. Start each command the way [your repository installs gspot](/start/install/#add-gspot), such as \`bunx --no-install gspot\` or \`mise exec -- gspot\`.\n\n`;
export const DEFINITION_HEADING = 'What it is';
export const ENVIRONMENT_VARIABLES: ReadonlyArray<[name: string, meaning: string]> = [
    ['`NO_COLOR`', 'Any nonempty value turns color off.'],
    ['`XDG_CACHE_HOME`, `LOCALAPPDATA`', 'The cache folder; it must be an absolute path.'],
    [
        '`GITHUB_TOKEN`',
        'A GitHub token for the release lookups of mise in `gspot init`, `gspot install`, and `gspot scan`. Without one, GitHub allows 60 lookups an hour.',
    ],
    [
        '`GITHUB_ACTIONS`',
        'When `true`, `gspot check` keeps tool output from running workflow commands, and prints each finding as an error annotation.',
    ],
];
export const ENVIRONMENT_VARIABLES_HEADING = 'Environment variables';
export const EXAMPLE_MESSAGE = 'For example:';
export const EXIT_CODES_HEADING = 'Exit codes';
export const EXIT_CODE_HEADING = 'Exit code';
export const GLOBAL_OPTIONS_HEADING = 'Global options';

// configuration pages
export const ALL_FILES_LABEL = 'All files in the scope';
export const ALWAYS_SELECTED_MESSAGE = 'Always.';
export const CONDITION_SEPARATOR = ', or ';
export const CONFIGURATIONS_OPENING =
    'gspot selects configurations from the files of each scope. `gspot add <name>` and ' +
    '`gspot remove <name>` change the selection, and `gspot list` shows it.\n';
export const CONFIG_FILES_HEADING = 'Files gspot writes';
export const DEFAULTS_HEADING = 'Defaults set for other configurations';
export const IGNORED_PATHS_HEADING = 'Paths that must stay out of Git';
export const INSTALLED_HEADING = 'Installed when';
export const LOCAL_FILES_MESSAGE = '`repository/local-files` reports a tracked file at these paths.';
export const RULES_OFF_HEADING = 'Lint rules turned off';
export const RULE_FILES_HEADING = 'Rules for coding agents';
export const RULE_FILE_HEADING = 'Rule file';
export const SELECTED_HEADING = 'Selected when';
export const SELF_INSTALL_LABEL = ', install it yourself';
export const SETS_HEADING = 'What it sets';
export const TOOLS_VERSIONS_HEADING = 'Tools and versions';

// content collections
export const CHANGELOG_PATH = 'changelog';
export const DOCS_SOURCE_NAME = 'gspot-docs';
export const PAGES_FOLDER = 'src/content/docs';
export const REFERENCE_IDS_KEY = 'reference-ids';

// ESLint plugin pages
export const DEFAULT_OPTION_DESCRIPTION = 'See the example.';
export const ESLINT_FIX_MESSAGE = ' `eslint --fix` fixes it.';
export const NO_CONFIG_MESSAGE = 'No config turns it on; turn it on in your ESLint config.';
export const TOPIC_LABELS = {
    accessibility: 'Accessibility',
    assertions: 'Assertions',
    aws: 'AWS CDK',
    collections: 'Collections',
    comments: 'Comments',
    'control-flow': 'Control flow',
    cryptography: 'Cryptography',
    functions: 'Functions',
    layout: 'Code layout',
    logic: 'Logic',
    networks: 'Networks',
    promises: 'Promises',
    react: 'React',
    regex: 'Regular expressions',
    security: 'Security',
    servers: 'Servers',
    structure: 'Code structure',
    testing: 'Tests',
    types: 'Types',
    utilities: 'Utility libraries',
    variables: 'Variables',
    vue: 'Vue',
    web: 'Web',
} as const;
export const TYPE_INFORMATION_MESSAGE = ' It reports nothing without the type information of a TypeScript project.';

// heading levels
export const MINOR_HEADING_LEVEL = 4;
export const SUBSECTION_HEADING_LEVEL = 3;
export const TABLE_HEADING_LEVEL = 2;

// levels
export const LEVEL_ADVICE = {
    basic: 'Choose it for an existing codebase or a first try, where a wrong finding on correct code costs the most.',
    all: 'Choose it for a new repository or one that coding agents write, where the code can follow the strict style rules from the start.',
} as const;
export const LEVEL_SUGGESTION =
    '`basic` for an existing codebase, and `all` for a new repository or one that coding agents write';

// reference markdown
export const LITERAL_CONSTRUCTS = ['htmlFlow', 'htmlText', 'autolink', 'attention', 'characterReference'];
export const OPTION_FLAG = /(?<![\w-])--(?:[a-z][a-z-]*)?(?![\w-])/gu;
export const SECTION_HEADING = /^## /mu;

// reference paths
export const REFERENCE_PATH = new URL(DOCS_PATHS.reference).pathname;
export const REFERENCE_FOLDERS = Object.fromEntries(
    ['commands', 'settings', 'configurations', 'checks', 'eslintPlugin'].map((name) => [
        name,
        new URL(DOCS_PATHS[name as keyof typeof DOCS_PATHS]).pathname.slice(REFERENCE_PATH.length, -1),
    ]),
) as Record<'commands' | 'settings' | 'configurations' | 'checks' | 'eslintPlugin', string>;
export const PLUGIN_PATH = `${REFERENCE_PATH}${REFERENCE_FOLDERS.eslintPlugin}/`;

// schema text
export const SCHEMA_TYPE_LABELS: Readonly<Record<string, string>> = {
    string: 'Text',
    integer: 'Whole number',
    number: 'Number',
    boolean: '`true` or `false`',
    array: 'List',
    object: 'Table',
    // A rule table checks each rule through a preprocess step, so its schema reports a transform.
    transform: 'Table',
};
export const SENTENCE_END = /[.\n]$/u;

// settings pages
export const ANGLE_BRACKETS = /[<>]/gu;
export const BANNED_NAME_MESSAGE =
    'See [Accept a banned name](/configure/gspot-toml/#accept-a-banned-name) for an exact-name exception.\n\n';
export const CATEGORY_PLACEHOLDER = '<category>';
export const LANGUAGE_PLACEHOLDER = '<language>';
export const LISTED_VALUES_LIMIT = 12;
export const MONOREPOS_SCOPE_MESSAGE = 'See [Monorepos](/configure/monorepos/) for how a scope inherits settings.\n\n';
export const NAME_PLACEHOLDER = '<name>';
export const REASONED_VALUE_LABEL = '`{ value = …, reason = "…" }`';
export const TOP_LEVEL_ANCHOR = 'top-level-settings';
export const TOP_LEVEL_HEADING = 'Top-level settings';

// setup text
export const CURL_COMMAND = 'curl -fsSL';
export const EVALUATION_HEADING = 'Try gspot';
export const RELEASE_AGE_EXCLUSIONS = [
    { label: 'pnpm', key: 'minimumReleaseAgeExclude', file: 'pnpm-workspace.yaml' },
    { label: 'Bun', key: 'install.minimumReleaseAgeExcludes', file: 'bunfig.toml' },
    { label: 'npm', key: 'min-release-age-exclude', file: '.npmrc' },
    { label: 'Yarn', key: 'npmPreapprovedPackages', file: '.yarnrc.yml' },
] as const;

// shared headings
export const CHECKS_HEADING = 'What it checks';
export const HELP_HEADING = 'What to do';
export const LINT_RULES_HEADING = 'Lint rules';
export const PURPOSE_HEADING = 'What it does';
