export const FROZEN_NONE = 'none';

export const FROZEN_ALL = 'all';

/** Numeric migration versions can use Flyway's V prefix. */
export const MIGRATION_VERSION = /^V?(?<version>\d+)/u;
