export const SCHEMA_URL = 'https://generativespotting.com/gspot.schema.json';
export const INTERNAL_FACT_KEYS = [
    'configurations',
    'languages',
    'categories',
    'reason_needed',
    'reason_values',
    'language_defaults',
    'path_role',
    'default_all',
] as const;
export const TABLE_DESCRIPTIONS: Readonly<Record<string, string>> = {
    scope: 'Settings for one folder: its configurations and the tables that differ from the root.',
    import_rule:
        'Groups of files in import order: code may import the files of its own rule and of every rule listed above it.',
    javascript: 'The script files, which may print to the console and exit, and the modules the runtime provides.',
    python: 'The modules that the host application provides, and the folders basedpyright also searches.',
    trpc: 'The files that declare tRPC procedures, and the server files that other files import only as types.',
    zustand: 'The files that may create a Zustand store.',
    format: 'Indentation, line width, quotes, and line endings for every formatter, with overrides for some paths.',
    limits: 'Size and complexity limits for files and functions, with values per language.',
    naming: 'Banned words, case, and length for the names of files, folders, and identifiers, with values per language.',
    cloudflare: 'The file that holds the generated Cloudflare binding types, and its interface name.',
    coverage: 'The lowest test coverage that the test checks accept.',
    dependencies:
        'How many days a new release waits before an install picks it up, and the registries that lockfiles may use.',
    docs: 'Headings that documentation may not use, and URLs that the link check accepts.',
    drizzle: 'The names of Drizzle clients in your code.',
    licenses: 'The licenses that dependencies may have, and single packages accepted with a reason.',
    openapi: 'The committed OpenAPI document, and the command that generates it.',
    postgres: 'The migrations folder, the schemas that clients read, and the migrations that may not change.',
    secrets: 'The env example files, and the functions in your code that read environment variables.',
    site: 'How the site builds, where the built files go, and the size limits of its files.',
    spelling: 'The language of the spelling check, such as en-us or en-gb.',
    supabase: 'The folders of Supabase edge functions, the schemas, and the generated types file.',
    translations: 'The base locale and the folder of message files.',
    swift: 'The Xcode project, scheme, and destination that the Swift build uses.',
    repository: 'The largest file that Git may track, in kilobytes.',
    prose: 'The longest sentence, list item, and paragraph that the prose check accepts.',
    duplication: 'The smallest copy, in lines and tokens, that the duplication check reports.',
    xcode: 'The entitlements that an Xcode project may request.',
    tools: 'Options for single tools, such as lint rule options. gspot writes them into the config files.',
    ignore: 'Checks and lint rules turned off for some paths or everywhere, each with a reason.',
    command_check: 'Your own commands, run as checks with a stage, a file list, and an output format.',
    structure:
        'Whether files may re-export the exports of other files, and which files may read environment variables.',
    hooks: 'Whether gspot install turns on the Git hooks.',
    ci: 'Whether gspot writes a CI workflow, for which provider, and on which systems it runs.',
    rules: 'Whether gspot writes rules for coding agents, and which rule files it leaves out.',
};
export const JSON_SCHEMA_DIALECT = 'https://json-schema.org/draft/2020-12/schema';
export const SCHEMA_FILE = 'gspot.schema.json';
