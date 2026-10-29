export const MARKDOWNLINT_ALL_RULES = ['MD041', 'MD025'] as const;

export const MARKDOWNLINT_RULES = {
    MD018: true,
    MD020: true,
    MD033: false,
    MD024: { siblings_only: true },
    MD046: { style: 'fenced' },
} as const;

export const PRETTIER_STYLE = 'markdownlint/style/prettier';

export const MARKDOWNLINT_CHECK = 'markdown/markdownlint';

export const MARKDOWNLINT_PRETTIER_DISABLED = ['MD013'] as const;
