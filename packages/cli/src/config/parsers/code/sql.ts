export const FROZEN_ALL = 'all';

export const FROZEN_VERSION = /^V?\d+$/u;

export const FROZEN_NONE = 'none';

export const MIGRATION_VERSION = /^V?(?<version>\d+(?:[._]\d+)*)/u;

export const IDENTIFIER_START = /[A-Za-z_]/u;

export const WORD_CHARACTER = /\w/u;

export const DOLLAR_TAG_BLOCKER = /[\p{L}\p{N}_$]/u;

export const PRISMA_MIGRATION_FILE = 'migration.sql';
