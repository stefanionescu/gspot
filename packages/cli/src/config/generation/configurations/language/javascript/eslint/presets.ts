export const ESLINT_PRESETS_FILE = 'eslint-presets.json';

export const TABINDEX_RULES = [
    'jsx-a11y/no-noninteractive-tabindex',
    'astro/jsx-a11y/no-noninteractive-tabindex',
] as const;

/** Roles that may take tabIndex: a tab panel, as jsx-a11y allows, and a scrollable region that keyboards must reach. */
export const FOCUSABLE_ROLES = ['tabpanel', 'region'] as const;
