/** SQL whose psql tokens stay literal inside quotes and comments. */
export const QUOTED_PSQL_SOURCES = [
    "SELECT ':value', E'\\\\:value', $$:value$$, $body$\n\\set literal\n$body$;",
    '/* :value /* :nested */ :value */',
    '-- :value',
    'SELECT 1::int;',
] as const;
