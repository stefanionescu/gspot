/** Native disabled values must produce the matching accepted-finding command. */
export const DISABLED_RULES = [
    {
        tool: 'commitlint',
        configuration: 'commits',
        rule: 'subject-case',
        value: [0, 'always', 'sentence-case'],
        check: 'commits/commitlint',
    },
    {
        tool: 'yamllint',
        configuration: 'files',
        rule: 'line-length',
        value: 'disable',
        check: 'files/yamllint',
    },
];

export const INVALID_ENVIRONMENT_SETTINGS = [
    { table: 'dotenv', value: 'accessor = "read_env"', diagnostic: 'dotenv' },
    { table: 'secrets', value: 'accessor = "read_env"', diagnostic: 'accessor' },
    { table: 'secrets', value: 'enabled = false', diagnostic: 'enabled' },
    { table: 'secrets', value: 'reader_functions = "read_env"', diagnostic: 'reader_functions' },
    { table: 'secrets', value: 'reader_functions = [false]', diagnostic: 'reader_functions' },
    { table: 'secrets', value: 'reader_functions = [""]', diagnostic: 'reader_functions' },
    { table: 'secrets', value: 'env_examples = [false]', diagnostic: 'env_examples' },
];

/** Malformed explanations are document-shape errors, independent of exception enforcement. */
export const MALFORMED_REASON_CASES = [
    { name: 'numeric', reason: 42, received: 'number' },
    { name: 'boolean', reason: false, received: 'boolean' },
    { name: 'array', reason: [], received: 'array' },
    { name: 'table', reason: {}, received: 'object' },
] as const;

/** Former path allowances replaced by check-specific ignore records. */
export const REMOVED_STRUCTURE_SETTINGS = ['lone_files_allowed', 'prefix_collisions_allowed', 'folder_names_allowed'];

/** Settings whose declared paths are validated before checks use them. */
export const PATH_SETTINGS = [
    { configuration: 'security', table: 'tools.codeql', setting: 'languages', list: true, empty: false },
    { configuration: 'site', table: 'site', setting: 'build_folder', list: false, empty: false },
    { configuration: 'swift', table: 'swift', setting: 'xcode_project', list: false, empty: true },
    { configuration: 'cloudflare', table: 'cloudflare', setting: 'types_file', list: false, empty: false },
    { configuration: 'openapi', table: 'openapi', setting: 'document', list: false, empty: true },
];

/** Unknown authored keys name their exact table before their corrected input is accepted. */
export const UNKNOWN_KEY_CASES = [
    {
        name: 'an unknown key names its table',
        text: 'configurations = ["bash"]\n[hooks]\npush_files = "all"\npsh = "all"\n',
        message: '`psh` is not a setting gspot knows under [hooks]',
        correction: ['psh = "all"\n', ''] as const,
    },
    {
        name: 'an unknown nested key',
        text: '[scope."api"]\nkitz = []\n',
        message: '`kitz` is not a setting gspot knows under [scope.api]',
        correction: ['kitz', 'configurations'] as const,
    },
];
