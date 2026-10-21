export const SQL_EXTENSION = '.sql';

export const FROZEN_NONE = 'none';

export const FROZEN_ALL = 'all';

/** Numeric migration versions can start with the Flyway V prefix. */
export const MIGRATION_VERSION = /^V?(?<version>\d+)/u;

export const IDENTIFIER_START = /[A-Za-z_]/u;

export const WORD_CHARACTER = /\w/u;

export const DOLLAR_TAG_BLOCKER = /[\p{L}\p{N}_$]/u;

export const MIGRATION_NUMBER = /^\d+$/u;
