export const FROZEN_ALL = 'all';

export const MIGRATION_NUMBER = /^\d+$/u;

export const FROZEN_NONE = 'none';

/** Numeric migration versions can start with the Flyway V prefix. */
export const MIGRATION_VERSION = /^V?(?<version>\d+)/u;
