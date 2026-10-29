export const SQLFLUFF_CAPITALISATION = {
    'capitalisation.keywords': { capitalisation_policy: 'upper' },
    'capitalisation.identifiers': { extended_capitalisation_policy: 'lower' },
    'capitalisation.functions': { extended_capitalisation_policy: 'lower' },
    'capitalisation.literals': { capitalisation_policy: 'upper' },
    'capitalisation.types': { extended_capitalisation_policy: 'upper' },
} as const;

export const SQL_FILE_EXTENSIONS = '.sql,.pgsql,.psql';

export const SQLFLUFF_DEFAULT_LEVEL_OFF = ['AM05', 'AM09', 'CV11', 'ST05', 'ST07', 'ST09'] as const;

export const SQLFLUFF_CHECK = 'sql/sqlfluff';
