/** Native source rules shared by HTML source and built-site validation. */
export const HTML_RULES = {
    'doctype-style': ['error', { style: 'lowercase' }],
    'no-inline-style': 'error',
    'no-raw-characters': 'error',
    'void-style': ['error', { style: 'selfclosing' }],
};

/** HTML API and style choices that run only at level all. */
export const HTML_ALL_RULES = ['no-inline-style', 'prefer-button', 'prefer-native-element'];
