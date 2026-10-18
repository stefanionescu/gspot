/** A code span, which generated reference text keeps as written. */
const CODE_SPAN = /(?<!`)(?<delimiter>`+)(?!`)[\s\S]+?(?<!`)\k<delimiter>(?!`)/u;
/** A tag of a definition list, with its attributes. */
const DEFINITION_TAG = /<\/?d[dlt][^<>]*>/u;

const GUIDES = {
    javascript: { path: '/languages/javascript-typescript/', title: 'JavaScript and TypeScript' },
    python: { path: '/languages/python/', title: 'Python' },
    css: { path: '/languages/css/', title: 'CSS' },
    swift: { path: '/languages/swift/', title: 'Swift' },
    security: { path: '/checks/security/', title: 'Security and secrets' },
    testing: { path: '/checks/testing/', title: 'Tests and coverage' },
    dependencies: { path: '/checks/dependencies/', title: 'Dependencies and licenses' },
    prose: { path: '/checks/prose/', title: 'Spelling and prose' },
} as const;

/** Labels for the conditions that select configurations and rules. */
export const DETECTION_LABELS = {
    extensions: 'File extensions',
    filenames: 'Filenames',
    dependencies: 'Dependencies',
    shebangs: 'Script interpreters',
    runtimes: 'JavaScript runtimes',
    tags: 'Files marked',
    paths: 'File paths',
    project_files: 'Project files',
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

/** The level of a plugin rule that no level turns on. */
export const PLUGIN_RULE_WITHOUT_LEVEL = 'none; turn it on in your ESLint config';

export const REFERENCE_FOLDERS = {
    commands: 'commands',
    configurations: 'configurations',
    checks: 'checks',
    eslintPlugin: 'eslint-plugin',
} as const;
export const REFERENCE_COLLECTION_NAME = 'gspot-reference';
export const REFERENCE_IDS_KEY = 'reference-ids';
export const PAGES_FOLDER = 'src/content/docs';
/** Matches code spans and definition list tags to keep, and markup to escape, in generated reference text. */
export const MARKDOWN_ESCAPES = new RegExp(`${CODE_SPAN.source}|${DEFINITION_TAG.source}|[<>]`, 'gu');

/** Matches code blocks and code spans to keep, and command flags outside them to put in code. */
export const FLAGS_OUTSIDE_CODE = /```[\s\S]*?```|`[^`]*`|(?<![\w-])--[a-z][a-z-]*/gu;

export const HTML_BRACKET_ENTITIES: Readonly<Record<string, string>> = { '<': '&lt;', '>': '&gt;' };

export const SECTION_HEADING = /^## /mu;
export const SETTING_PLACEHOLDER = /^\{setting:(?<setting>[^}]+)\}$/u;
/** A list of allowed values longer than this prints as a count; editors read the full list from the schema. */
export const LISTED_VALUES_LIMIT = 12;
/** The check that reads the suppression comments of every tool. */
export const SUPPRESSIONS_CHECK = 'gspot/suppressions';

/** The tables with their own settings page: the title and description of each page. */
export const SETTINGS_SUBPAGES = new Map([
    [
        'limits',
        { title: '[limits] settings', description: 'Size and complexity limits for the repository or one language.' },
    ],
    ['naming', { title: '[naming] settings', description: 'Banned words, case, and length rules for names.' }],
    ['tools', { title: '[tools] settings', description: 'Options that gspot passes to each tool.' }],
    ['command_check', { title: '[[command_check]] records', description: 'Your own commands, run as checks.' }],
]);
/** The name of the keys of a map table, such as the language under limits. */
export const MAP_KEY_NAME = '<name>';
export const ANGLE_BRACKETS = /[<>]/gu;
/** The heading level of a page title. */
export const PAGE_TITLE_LEVEL = 1;
/** How a reasoned value reads in the accepted values of a setting. */
export const REASONED_VALUE_LABEL = 'a reasoned value `{ value = …, reason = "…" }`';
/** The characters that a heading ID leaves out of the heading text, as Starlight writes it. */
export const HEADING_ID_DROPPED = /[^\p{L}\p{N} _-]/gu;
/** The placeholders of the language and the category of names in a language table key. */
export const LANGUAGE_PLACEHOLDER = '<language>';
export const CATEGORY_PLACEHOLDER = '<category>';

/** The guide page of each configuration that has one. */
export const CONFIGURATION_GUIDES: Readonly<Record<string, { path: string; title: string }>> = {
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

export const EXIT_CODE_LINE = /^ {2}(\d+(?:(?:, | or )\d+)?) {2,}/gmu;

export const HELP_CONTINUATION = /^ {4,}(?=\S)/gmu;
