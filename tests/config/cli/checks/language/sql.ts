export const FOREIGN_DIALECT_CASES = [
    { dialect: 'sqlite', source: 'PRAGMA table_info (users);\n' },
    { dialect: 'mysql', source: 'SELECT `secret` FROM records;\n' },
    { dialect: 'duckdb', source: 'SELECT * EXCLUDE (secret) FROM records;\n' },
];
