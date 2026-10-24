export const VUE_FILES = ['**/*.vue'] as const;

export const VUE_RULES = {
    'vue/require-default-prop': 'off',
    'vue/component-api-style': ['error', ['script-setup']],
    'vue/no-useless-v-bind': 'error',
    'vue/prefer-true-attribute-shorthand': 'error',
    'vue/no-unused-refs': 'error',
    'vue/require-typed-ref': 'error',
    'vue/html-button-has-type': 'error',
    'vue/no-template-target-blank': 'error',
} as const;
