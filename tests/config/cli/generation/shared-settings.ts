export const KNIP = '.gspot/config/knip.json';
export const STYLELINT = '.gspot/config/stylelint.json';
export const RUFF = '.gspot/config/ruff.toml';

/** Stable Tailwind directives belong to a project that declares the framework. */
export const TAILWIND_AT_RULES = [
    'tailwind',
    'apply',
    'layer',
    'theme',
    'utility',
    'variant',
    'custom-variant',
    'source',
    'plugin',
    'config',
    'reference',
];

export const TAILWIND_PROJECT_FILES = {
    'package.json': '{"private":true,"devDependencies":{"tailwindcss":"4.1.13"}}\n',
};
