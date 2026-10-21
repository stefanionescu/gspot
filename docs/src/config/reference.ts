/** A code span, which generated reference text keeps as written. */
const CODE_SPAN = /(?<!`)(?<delimiter>`+)(?!`)[\s\S]+?(?<!`)\k<delimiter>(?!`)/u;
/** A tag that generated reference text writes on purpose: a heading with its anchor, or code. */
const KEPT_TAG = /<\/?(?:h[2-6]|code)(?:\s[^<>]*)?>/u;

export const INLINE_CODE_SPAN = /(`[^`]+`)/u;

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

/** Labels for the conditions that select configurations and rules. */
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

/** Plain labels for JSON schema types in settings tables. */
export const SCHEMA_TYPE_LABELS = {
    string: 'Text',
    integer: 'Whole number',
    number: 'Number',
    boolean: '`true` or `false`',
    array: 'List',
    object: 'Table',
} as const;

/** Labels for how often a check runs. */
export const CHECK_RUN_LABELS = {
    once: 'once for the repository',
    scope: 'once per scope',
    files: 'per file',
    history: 'once for pushed history',
} as const;

/** What each need of a check asks for. */
export const CHECK_NEEDS_LABELS = {
    build: 'a build of the project',
    docker: 'Docker, running',
    network: 'network access',
} as const;

/** What each level checks, and when to choose it. */
export const LEVEL_DESCRIPTIONS = {
    recommended:
        'Bugs, security and accessibility problems, type errors, formatting, and misuse of declared frameworks and libraries. Choose it for an existing codebase or a first run.',
    all: 'Also naming, wording, code structure, doc comments, declaration order, duplication, API style, and complexity. Choose it for a new repository or one that coding agents write.',
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
/** The first sentence of a text: everything up to the first period that ends a sentence. */
export const FIRST_SENTENCE = /^[\s\S]*?\.(?=\s|$)/u;
export const REFERENCE_COLLECTION_NAME = 'gspot-reference';
export const REFERENCE_IDS_KEY = 'reference-ids';
export const PAGES_FOLDER = 'src/content/docs';
/** Matches code spans and kept tags to keep, and markup to escape, in generated reference text. */
export const MARKDOWN_ESCAPES = new RegExp(`${CODE_SPAN.source}|${KEPT_TAG.source}|[<>]`, 'gu');

/** Matches code blocks and code spans to keep, and command flags outside them to put in code. */
export const FLAGS_OUTSIDE_CODE = /```[\s\S]*?```|`[^`]*`|(?<![\w-])--[a-z][a-z-]*/gu;

export const HTML_BRACKET_ENTITIES: Readonly<Record<string, string>> = { '<': '&lt;', '>': '&gt;' };

export const SECTION_HEADING = /^## /mu;
/** A list of allowed values longer than this prints as a count; editors read the full list from the schema. */
export const LISTED_VALUES_LIMIT = 12;
/** The check that reads the suppression comments of every tool. */
export const SUPPRESSIONS_CHECK = 'gspot/suppressions';

/** The tables with their own settings page: the title and description of each page. */
/** The name of the keys of a map table, such as the language under limits. */
export const MAP_KEY_NAME = '<name>';
export const ANGLE_BRACKETS = /[<>]/gu;
/** The heading level of a gspot.toml table on the settings page; its keys sit one level below. */
export const TABLE_HEADING_LEVEL = 2;
/** How a reasoned value reads in the accepted values of a setting. */
export const REASONED_VALUE_LABEL = 'a reasoned value `{ value = …, reason = "…" }`';
/** The characters that a heading ID leaves out of the heading text, as Starlight writes it. */
export const HEADING_ID_DROPPED = /[^\p{L}\p{N} _-]/gu;
/** The placeholders of the language and the category of names in a language table key. */
export const LANGUAGE_PLACEHOLDER = '<language>';
export const CATEGORY_PLACEHOLDER = '<category>';

/** The guide page of each configuration that has one. */
export const CONFIGURATION_GUIDES: Readonly<Record<string, string>> = {
    javascript: GUIDES.javascript,
    typescript: GUIDES.javascript,
    nextjs: GUIDES.javascript,
    'react-native': GUIDES.javascript,
    python: GUIDES.python,
    css: GUIDES.css,
    swift: GUIDES.swift,
    xcode: GUIDES.swift,
    security: GUIDES.security,
    secrets: GUIDES.security,
    jest: GUIDES.testing,
    vitest: GUIDES.testing,
    pytest: GUIDES.testing,
    dependencies: GUIDES.dependencies,
    licenses: GUIDES.dependencies,
    prose: GUIDES.prose,
    spelling: GUIDES.prose,
};

/** The environment variables that change what gspot does, and what each one does. */
export const ENVIRONMENT_VARIABLES: readonly [name: string, meaning: string][] = [
    ['`NO_COLOR`', 'Any nonempty value turns color off.'],
];
