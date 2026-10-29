export const QUOTED_PSQL_SOURCES = [
    "SELECT ':value', E'\\\\:value', $$:value$$, $body$\n\\set literal\n$body$;",
    '/* :value /* :nested */ :value */',
    '-- :value',
    'SELECT 1::int;',
] as const;

export const NESTED_COMMENT_SQL = [
    '-- 前言',
    '/* outer',
    ' /* nested */',
    '*/',
    'DROP TABLE app.users;',
    '-- Between statements.',
    '/* next */',
    ' SELECT 1;',
].join('\n');

export const FROZEN_MIGRATION_PATHS = ['db/V20240101__init.sql', 'db/V20240202__users.sql'] as const;

export const FROZEN_MIGRATION_CASES = [
    { through: '20240101', frozen: [FROZEN_MIGRATION_PATHS[0]] },
    { through: 'V20240101', frozen: [FROZEN_MIGRATION_PATHS[0]] },
    { through: 'none', frozen: [] },
    { through: 'all', frozen: FROZEN_MIGRATION_PATHS },
] as const;

export const SELECT_SQL = 'SELECT 2';
