/** The committed migration that creates the teams table. */
export const TEAMS_TABLE_SQL = 'CREATE TABLE teams (id integer PRIMARY KEY);\n';

/** Where the teams migration sits. */
export const TEAMS_MIGRATION_PATH = 'migrations/20240201_teams.sql';
