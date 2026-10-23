export const GOOGLE_DOCSTRING = /^[ \t]*(?:Args|Arguments|Keyword Args):[ \t]*$/mu;

export const NUMPY_DOCSTRING = /^[ \t]*Parameters[ \t]*\r?\n[ \t]*-{3,}[ \t]*$/mu;

export const PYDOCLINT_TYPE_OPTIONS = [
    'arg-type-hints-in-docstring',
    'check-return-types',
    'check-yield-types',
] as const;

export const PYDOCLINT_COMMAND = ['pydoclint', '--allow-init-docstring', 'true', '--quiet', '{files}'] as const;

export const PYDOCLINT_STYLE_FLAG = '--style';

export const PYDOCLINT_DEFAULT_STYLE = 'numpy';

export const DOCSTRING_STYLES = ['google', 'numpy', 'sphinx'] as const;
