export const NESTED_POLICY = `configurations = []
[[scope]]
path = "apps/api"
configurations = ["supabase"]
[scope.supabase]
types_file = "database.ts"
[[scope]]
path = "apps/web"
configurations = ["supabase"]
[scope.supabase]
types_file = "database.ts"
`;

export const API_MIGRATIONS = {
    '20261004000000_api.sql': 'create table public.api_records (id bigint primary key);\n',
};
export const WEB_MIGRATIONS = {
    '20261004000000_web.sql': 'create table public.web_records (slug text primary key);\n',
};
