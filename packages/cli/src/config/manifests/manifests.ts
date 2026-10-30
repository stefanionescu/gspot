export const DEFAULT_GROUPED_PATTERN = String.raw`^\s+(?<line>\d+): (?<message>.*)$`;

export const DEFAULT_FILE_PATTERN = String.raw`^(?<file>[^\s].*):$`;

export const DEFAULT_PATTERN = String.raw`^(?<file>[^:\s][^:]*):(?<line>\d+):(?:(?<column>\d+):)?\s*(?<message>.*)$`;

export const DEFAULT_OUTPUT_FORMAT = { format: 'regex', pattern: DEFAULT_PATTERN } as const;

export const MAX_EXIT_CODE = 255;

export const VALID_UNICODE_MESSAGE = 'Use a valid Unicode regular expression.';

export const NAME_PATTERN = /^[a-z0-9-]+$/u;

export const RULE_FILE_PATTERN = /^[A-Z0-9-]+\.md$/u;

export const NAMING_DEFAULTS_FILE = 'configurations/general/naming/defaults.json';

export const NAMED_CATEGORIES = [
    'schemas',
    'tables',
    'columns',
    'indexes',
    'triggers',
    'policies',
    'functions',
    'parameters',
    'classes',
    'exceptions',
    'methods',
    'variables',
    'constants',
    'attributes',
    'type_aliases',
    'types',
    'properties',
    'enum_cases',
    'files',
    'folders',
    'modules',
    'packages',
    'path_parameters',
] as const;

export const CASE_NAMES = [
    'camel',
    'pascal',
    'pascal-extension',
    'kebab',
    'snake',
    'upper-snake',
    'timestamp-snake',
] as const;

export const MANIFEST_FILE = 'manifest.toml';

export const RULES_FOLDER = 'rules';

export const SOURCE_FILE_GROUPS = ['language', 'framework'] as const;
