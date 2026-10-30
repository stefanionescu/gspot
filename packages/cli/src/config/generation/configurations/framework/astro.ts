import { FOCUSABLE_ROLES } from '#cli/config/generation/configurations/framework/react.ts';

export const ASTRO_FILES = ['**/*.astro'] as const;

export const ASTRO_RULES = {
    'astro/no-set-html-directive': 'error',
    'astro/no-exports-from-components': 'error',
    'astro/no-prerender-export-outside-pages': 'error',

    'astro/no-unused-css-selector': 'error',
    'astro/prefer-class-list-directive': 'error',
    'astro/prefer-object-class-list': 'error',
    'astro/prefer-split-class-list': 'error',
} as const;

export const ASTRO_RULE_OPTIONS = { 'astro/jsx-a11y/no-noninteractive-tabindex': { roles: [...FOCUSABLE_ROLES] } };

export const ASTRO_TYPED_RULES = { '@typescript-eslint/no-unsafe-return': 'off' } as const;

export const ASTRO_SCRIPT_FILES = ['**/*.astro/*.ts', '**/*.astro/*.js'] as const;
