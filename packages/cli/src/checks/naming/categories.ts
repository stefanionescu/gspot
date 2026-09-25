/** The identifier categories a setting can narrow to; every other category borrows the limits of one of these. */
export const CATEGORY_PARENTS: Record<string, string> = {
    classes: 'types',
    type_aliases: 'types',
    exceptions: 'types',
    methods: 'functions',
    constants: 'variables',
    attributes: 'properties',
    enum_cases: 'properties',
    modules: 'files',
    packages: 'directories',
};

/** The leading verb allowed only in framework callback positions. */
export const CALLBACK_VERB = 'handle';

/** The digits of a migration timestamp, YYYYMMDDHHMMSS. */
export const MIGRATION_TIMESTAMP_DIGITS = 14;
