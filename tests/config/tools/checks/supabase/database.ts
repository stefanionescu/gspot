export const DATABASE_START = [
    'supabase',
    'start',
    '--exclude',
    'gotrue,realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor',
];

export const DATABASE_COMMAND_TIMEOUT = 180_000;

export const DOCKER_STATUS_TIMEOUT = 10_000;
