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

/** Plain labels for JSON schema types presented in settings tables. */
export const SCHEMA_TYPE_LABELS = {
    string: 'Text',
    integer: 'Whole number',
    number: 'Number',
    boolean: 'true or false',
    array: 'List',
    object: 'Table',
} as const;

/** Labels for the manifest check run frequency. */
export const CHECK_RUN_LABELS = {
    once: 'once for the repository',
    scope: 'once per scope',
    files: 'per file',
    history: 'once for pushed history',
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
/** Preserve Markdown code while escaping markup in generated reference text. */
export const MARKDOWN_ESCAPES = /(?<!`)(?<delimiter>`+)(?!`)[\s\S]+?(?<!`)\k<delimiter>(?!`)|<\/?d[dlt]>|[<>]/gu;

export const HTML_BRACKET_ENTITIES: Readonly<Record<string, string>> = { '<': '&lt;', '>': '&gt;' };

export const OPTION_NAME = /(?<![\w`-])--[a-z-]*/gu;
export const SECTION_HEADING = /^## /mu;
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
