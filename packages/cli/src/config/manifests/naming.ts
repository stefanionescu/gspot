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
