export const SECURITY_DEFINER_MESSAGE =
    'This SECURITY DEFINER function sets no search_path. Set an explicit search_path so callers cannot choose the objects it accesses.';

export const FROZEN_EDIT_MESSAGE =
    'This migration is at or before postgres.frozen_through and differs from its committed text. Restore it and write a new migration.';

export const MIGRATION_ORDER_MESSAGE = 'A new migration sorts before 20240201_teams.sql, which is already committed.';
