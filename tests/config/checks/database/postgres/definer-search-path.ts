export const DEFINER_FUNCTION_SQL =
    'CREATE FUNCTION grant_access() RETURNS void LANGUAGE sql SECURITY DEFINER AS $$ SELECT 1 $$;\n';

export const DEFINER_REPAIRS = [
    {
        name: 'replacement',
        sql: "CREATE OR REPLACE FUNCTION public.grant_access() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$ SELECT 1 $$;\n",
    },
    { name: 'alteration', sql: "ALTER FUNCTION public.grant_access() SET search_path = '';\n" },
    { name: 'removal', sql: 'DROP FUNCTION public.grant_access();\n' },
] as const;

export const SECURITY_ALTERATIONS = [
    { change: 'SECURITY DEFINER', initial: '', unsafe: true },
    { change: 'SECURITY INVOKER', initial: 'SECURITY DEFINER', unsafe: false },
    { change: 'RESET search_path', initial: "SECURITY DEFINER SET search_path = ''", unsafe: true },
    { change: 'RESET ALL', initial: "SECURITY DEFINER SET search_path = ''", unsafe: true },
    { change: "SET search_path = ''", initial: 'SECURITY DEFINER', unsafe: false },
] as const;
