export const DEPTRY_FIRST_PARTY_FLAG = '--known-first-party';

export const DEPTRY_COMMAND = ['deptry', '.', '--no-ansi'] as const;

export const DEPTRY_EXCLUDE_FLAG = '--extend-exclude';

export const INSTALL_FILE_SUFFIXES = ['.sh', '.bash', '.yml', '.yaml', '.toml', 'Dockerfile'] as const;

export const PIP_INSTALL = /\bpip3? install\b/u;

export const NON_WORD_RUN = /[^a-z\d]+/gu;

export const PLACEHOLDERS = new Set(['todo', 'docstring', 'tbd', 'fixme', 'description', 'summary']);

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

export const VULTURE_FINDING =
    /^(?<file>.+?):(?<line>\d+): (?:unused (?<kind>attribute|class|function|method|property) '(?<name>[^']+)'|unreachable code after '(?<statement>[^']+)') \(\d+% confidence/u;

export const VULTURE_COMMAND = ['vulture'] as const;

export const VULTURE_DEAD_CODE = 3;
