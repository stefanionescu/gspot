export const PYTHON_FILES = ['**/*.py'] as const;

export const RUFF_ISORT = {
    'length-sort': true,
    'length-sort-straight': true,
    'force-sort-within-sections': true,
} as const;

export const RUFF_ALWAYS_OFF = [
    'COM812',
    'COM819',
    'D203',
    'D206',
    'D213',
    'D300',
    'I002',
    'N806',
    'N815',
    'N816',
    'N999',
    'ISC001',
    'ISC002',
    'Q000',
    'Q001',
    'Q002',
    'Q003',
    'RUF023',
    'W191',
] as const;
