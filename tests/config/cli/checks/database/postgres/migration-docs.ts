export const SECTIONS = ['Schema', 'Tables', 'Indexes', 'Functions', 'Triggers', 'Extensions'];

export const NAME = '20240101000000_create_teams.sql';

export const DOCUMENTED =
    '-- ============================================================================\n-- Migration: 20240101000000_create_teams.sql\n-- ============================================================================\n-- Purpose: Creates the teams table.\n-- ============================================================================\n\n-- ============================================================================\n-- Tables\n-- ============================================================================\n\n-- ============================================================================\n-- Table: teams\n-- Purpose: One row for each team.\n-- ============================================================================\nCREATE TABLE teams (id UUID PRIMARY KEY);\n\n-- ============================================================================\n-- Indexes\n-- ============================================================================\n\nCREATE INDEX teams_id_idx ON teams (id);\n';

export const HEADER_FINDINGS = [
    { rule: 'header', line: 1, message: 'Put the migration header between separator lines.' },
    { rule: 'header', line: 2, message: 'Write "-- Migration: 20240101000000_create_teams.sql" on the second line.' },
    { rule: 'header', line: 4, message: 'Start the fourth line with "-- Purpose:".' },
    { rule: 'section', line: 8, message: 'Put the "Tables" heading between separator lines.' },
];
