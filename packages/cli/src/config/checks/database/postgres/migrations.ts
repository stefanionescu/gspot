export const SQUAWK_CHECK = 'postgres/squawk';

export const DOWN_MIGRATION_SUFFIX = '.down.sql';

export const MIGRATION_SYNTAX_SKIP = 'A migration does not parse. postgres/migration-order reports where.';

/** Match the SQL comment line that starts the down section. */
export const MIGRATION_DOWN = /^[\t ]*--[\t ]*migrate:down\b/mu;
