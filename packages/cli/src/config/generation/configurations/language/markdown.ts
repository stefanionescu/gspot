export const MARKDOWNLINT_ALL_RULES = ['MD041', 'MD025'] as const;

export const MARKDOWNLINT_RULES = {
    default: true,
    MD013: false,
    MD033: false,
    MD024: { siblings_only: true },
    MD046: { style: 'fenced' },
    MD048: { style: 'backtick' },
    MD049: { style: 'underscore' },
    MD050: { style: 'asterisk' },
} as const;
