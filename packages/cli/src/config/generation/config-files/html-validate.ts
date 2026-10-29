export const HTML_VALIDATE_EXTENDS = ['html-validate:recommended'] as const;

export const HTML_DEFAULT_LEVEL_OFF = ['no-inline-style', 'prefer-button', 'prefer-native-element'] as const;

export const HTML_RULES = {
    'doctype-style': ['error', { style: 'lowercase' }],
    'void-style': ['error', { style: 'selfclosing' }],
} as const;

export const HTML_VALIDATE_OVERRIDES: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {
    site: {
        'no-inline-style': 'off',
        'no-raw-characters': 'off',
        'void-style': 'off',
        'doctype-style': 'off',
        'no-trailing-whitespace': 'off',
        'valid-id': ['error', { relaxed: true }],
    },
};
