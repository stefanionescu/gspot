export const PUBLIC_SCHEMA = 'public';

export const CONSTRAINT_SUFFIXES: Readonly<Record<string, string>> = {
    CONSTR_PRIMARY: 'pkey',
    CONSTR_UNIQUE: 'key',
    CONSTR_FOREIGN: 'fkey',
} as const;

export const SCHEMA_NAME_INDEX = -2;
