export const PATH_ROLES = ['source', 'destination', 'build'] as const;

export const SCHEMA_URL = 'https://generativespotting.com/gspot.schema.json';

export const HIDDEN_FACT_KEYS = [
    'configurations',
    'languages',
    'reason_when',
    'reason_values',
    'language_defaults',
    'path_role',
    'template',
    'default_all',
] as const;

export const JSON_SCHEMA_DIALECT = 'https://json-schema.org/draft/2020-12/schema';

export const SCHEMA_DESCRIPTION = 'The settings of gspot for one repository.';
