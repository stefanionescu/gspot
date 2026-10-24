export const MARKDOWNLINT_ALL_RULES = ['MD041', 'MD025'] as const;

export const MARKDOWNLINT_RULES = {
    default: true,
    MD013: false,
    MD018: true,
    MD020: true,
    MD033: false,
    MD024: { siblings_only: true },
    MD046: { style: 'fenced' },
} as const;
