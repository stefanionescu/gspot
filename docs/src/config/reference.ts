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
    boolean: 'true or false',
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

export const REFERENCE_FOLDERS = {
    commands: 'commands',
    configurations: 'configurations',
    checks: 'checks',
    eslintPlugin: 'eslint-plugin',
} as const;
export const REFERENCE_COLLECTION_NAME = 'gspot-reference';
export const REFERENCE_IDS_KEY = 'reference-ids';
export const PAGES_FOLDER = 'src/content/docs';
/** Matches code spans to keep and markup to escape in generated reference text. */
export const MARKDOWN_ESCAPES = /(?<!`)(?<delimiter>`+)(?!`)[\s\S]+?(?<!`)\k<delimiter>(?!`)|<\/?d[dlt]>|[<>]/gu;

/** Matches code blocks and code spans to keep, and command flags outside them to put in code. */
export const FLAGS_OUTSIDE_CODE = /```[\s\S]*?```|`[^`]*`|(?<![\w-])--[a-z][a-z-]*/gu;

export const HTML_BRACKET_ENTITIES: Readonly<Record<string, string>> = { '<': '&lt;', '>': '&gt;' };

export const SECTION_HEADING = /^## /mu;
export const SETTING_PLACEHOLDER = /^\{setting:(?<setting>[^}]+)\}$/u;
/** A list of allowed values longer than this prints as a count; editors read the full list from the schema. */
export const LISTED_VALUES_LIMIT = 12;
export const SETTINGS_SUBPAGES: readonly string[] = ['scope', 'limits', 'naming', 'tools', 'command_check'];
export const LANGUAGE_SETTING = /^(?<table>limits|naming)\.(?<language>[^.]+)\.(?<key>.+)$/u;

export const CONFIGURATION_GUIDES: Record<string, string> = {
    javascript: 'javascript-typescript',
    typescript: 'javascript-typescript',
    nextjs: 'javascript-typescript',
    'react-native': 'javascript-typescript',
    python: 'python',
    css: 'css',
};

export const EXIT_CODE_LINE = /^ {2}(\d+(?:(?:, | or )\d+)?) {2,}/gmu;

export const HELP_CONTINUATION = /^ {4,}(?=\S)/gmu;
