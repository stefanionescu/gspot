export const DRIZZLE_DRIVERS = [
    { driver: 'pg', postgres: true },
    { driver: 'postgres', postgres: true },
    { driver: 'mysql2', postgres: false },
    { driver: 'better-sqlite3', postgres: false },
] as const;
