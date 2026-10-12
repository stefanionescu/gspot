/** Intro text of the gspot.toml reference. */
export const GSPOT_TOML_INTRO = `Every table and key of \`gspot.toml\`, with its default. A value that loosens a check is written
\`{ value = ..., reason = "..." }\`. Any limit can be set for one language as \`limits.<language>.<name>\`.
A scope inherits the root and every scope that contains it: a single value replaces the inherited one, and a list adds to it.
A command (a list of arguments) replaces the inherited one as a whole. Every path is relative to the repository root.
Editors can use the JSON Schema that the \`#:schema\` line names to check the file as you type; gspot checks it fully when it runs.
See [Monorepos](/guides/monorepos/).

`;

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

/** Plain labels for JSON schema types presented in settings tables. */
export const SCHEMA_TYPE_LABELS = { array: 'List', object: 'Table' } as const;

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
export const MARKDOWN_ESCAPES = /(?<!`)(?<delimiter>`+)(?!`)[\s\S]+?(?<!`)\k<delimiter>(?!`)|[<>]/gu;

export const HTML_BRACKET_ENTITIES: Readonly<Record<string, string>> = { '<': '&lt;', '>': '&gt;' };
