/** The lint rules for HTML source files and for the built site. */
export const HTML_RULES = {
    'doctype-style': ['error', { style: 'lowercase' }],
    'no-inline-style': 'error',
    'no-raw-characters': 'error',
    'void-style': ['error', { style: 'selfclosing' }],
} as const;

/** The HTML lint rules that run only at level all. */
export const HTML_ALL_RULES = ['no-inline-style', 'prefer-button', 'prefer-native-element'] as const;

export const HTML_VALIDATE_EXTENDS = ['html-validate:recommended'] as const;
export const HTML_BUILT_OVERRIDES = {
    'no-inline-style': 'off',
    'no-raw-characters': 'off',
    'void-style': 'off',
    'doctype-style': 'off',
    'no-trailing-whitespace': 'off',
    'valid-id': ['error', { relaxed: true }],
} as const;
