export const FROZEN_RULE = 'frozen';

export const FROZEN_EDIT_MESSAGE =
    'This migration is at or before postgres.frozen_through and differs from its committed text. Restore it and write a new migration.';

export const FROZEN_THROUGH_NOTE = 'Set postgres.frozen_through to the last migration that has run everywhere.';
