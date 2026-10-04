export const SQL_FUNCTION_SOURCE =
    "CREATE FUNCTION get_user_name() RETURNS TEXT AS $$ SELECT 'Alex'; $$ LANGUAGE sql;\nSELECT get_user_name();\n";
