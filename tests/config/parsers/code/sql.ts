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
