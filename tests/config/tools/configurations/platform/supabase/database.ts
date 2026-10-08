// Excluding the other Supabase services starts Postgres alone for the database type checks.
export const DATABASE_START = [
    'supabase',
    'start',
    '--exclude',
    'gotrue,realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor',
];
