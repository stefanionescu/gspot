import { type GuideSlug } from '../types/reference.ts';

const CODE_SPAN = /(?<!`)(?<delimiter>`+)(?!`)[\s\S]+?(?<!`)\k<delimiter>(?!`)/u;

const KEPT_TAG = /<\/?(?:h[2-6]|code)(?:\s[^<>]*)?>/u;

export const GUIDES = {
    javascript: 'languages/javascript-typescript',
    python: 'languages/python',
    css: 'languages/css',
    swift: 'languages/swift',
    security: 'checks/security',
    testing: 'checks/testing',
    dependencies: 'checks/dependencies',
    prose: 'checks/prose',
} as const;

export const DETECTION_LABELS = {
    extensions: 'file extensions',
    filenames: 'filenames',
    dependencies: 'dependencies',
    shebangs: 'script interpreters',
    runtimes: 'JavaScript runtimes',
    tags: 'files marked',
    paths: 'file paths',
    project_files: 'project files',
} as const;

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
    docker: 'Docker, running',
    network: 'network access',
} as const;

export const LEVEL_ADVICE = {
    basic: 'Choose it for an existing codebase or a first run.',
    all: 'Choose it for a new repository or one that coding agents write.',
} as const;

export const REFERENCE_PATH = '/reference/';

export const REFERENCE_FOLDERS = {
    commands: 'commands',
    settings: 'gspot-toml',
    jsonOutput: 'json-output',
    configurations: 'configurations',
    checks: 'checks',
    eslintPlugin: 'eslint-plugin',
} as const;

export const FIRST_SENTENCE = /^[\s\S]*?\.(?=\s|$)/u;

export const DOCS_SOURCE_NAME = 'gspot-docs';

export const REFERENCE_IDS_KEY = 'reference-ids';

export const PAGES_FOLDER = 'src/content/docs';

export const MARKDOWN_ESCAPES = new RegExp(`${CODE_SPAN.source}|${KEPT_TAG.source}|[<>]`, 'gu');

export const FLAGS_OUTSIDE_CODE = /```[\s\S]*?```|`[^`]*`|(?<![\w-])--[a-z][a-z-]*/gu;

export const HTML_BRACKET_ENTITIES: Readonly<Record<string, string>> = { '<': '&lt;', '>': '&gt;' };

export const SECTION_HEADING = /^## /mu;

export const LISTED_VALUES_LIMIT = 12;

export const SUPPRESSIONS_CHECK = 'gspot/suppressions';

export const NAME_PLACEHOLDER = '<name>';

export const ANGLE_BRACKETS = /[<>]/gu;

export const TABLE_HEADING_LEVEL = 2;

export const REASONED_VALUE_LABEL = 'a reasoned value `{ value = …, reason = "…" }`';

export const HEADING_ID_STRIPPED = /[^\p{L}\p{N} _-]/gu;

export const LANGUAGE_PLACEHOLDER = '<language>';

export const CATEGORY_PLACEHOLDER = '<category>';

export const CONFIGURATION_GUIDES: Readonly<Partial<Record<string, GuideSlug>>> = {
    javascript: GUIDES.javascript,
    typescript: GUIDES.javascript,
    nextjs: GUIDES.javascript,
    react: GUIDES.javascript,
    'react-dom': GUIDES.javascript,
    expo: GUIDES.javascript,
    'react-native': GUIDES.javascript,
    python: GUIDES.python,
    css: GUIDES.css,
    swift: GUIDES.swift,
    xcode: GUIDES.swift,
    security: GUIDES.security,
    docker: GUIDES.security,
    'github-actions': GUIDES.security,
    secrets: GUIDES.security,
    jest: GUIDES.testing,
    vitest: GUIDES.testing,
    pytest: GUIDES.testing,
    dependencies: GUIDES.dependencies,
    licenses: GUIDES.dependencies,
    prose: GUIDES.prose,
    spelling: GUIDES.prose,
};

export const ENVIRONMENT_VARIABLES: readonly [name: string, meaning: string][] = [
    ['`NO_COLOR`', 'Any nonempty value turns color off.'],
    ['`CI`', 'Any CI variable that std-env reads makes init refuse to ask; pass `--yes`.'],
    ['`XDG_CACHE_HOME`, `LOCALAPPDATA`', 'The cache folder; it must be an absolute path.'],
];

export const CONJUNCTION_FORMAT = new Intl.ListFormat('en', { type: 'conjunction' });

export const DISJUNCTION_FORMAT = new Intl.ListFormat('en', { type: 'disjunction' });

export const CHECKS_OPENING =
    'Each check ID is `<configuration>/<name>`. The [stage](/start/concepts/#stage) says when it runs, and the ' +
    '[level](/start/concepts/#levels) says which setting of `level` turns it on. ' +
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

export const SELECTED_IN_GIT_MESSAGE = 'Always selected in a Git repository.';

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

export const DEFS_PREFIX = '#/$defs/';

export const SETTINGS_DESCRIPTION = 'Every key, accepted value, and default of gspot.toml.';

export const SETTINGS_OPENING =
    'Every key of `gspot.toml`, its accepted values, and its default. See [gspot.toml](/configure/gspot-toml/) to change them.\n\n';

export const TOP_LEVEL_HEADING = 'Top-level keys';

export const SENTENCE_END = /[.\n]$/u;

export const COMMANDS_OPENING = `Run gspot from any folder of the repository; it uses the \`gspot.toml\` at the top of the Git repository. Start each command the way your repository runs gspot, such as \`bun run --no-install gspot\` or \`mise exec -- gspot\`. See [Installation](/start/install/#choose-how-to-install). Commands that change settings write generated files too.\n\n`;
