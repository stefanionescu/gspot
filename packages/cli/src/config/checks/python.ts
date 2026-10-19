import { PYPROJECT_TOML } from '#cli/config/parsers/dependency-files.ts';

/** The pinned tool reads unclassified docstrings as NumPy style. */
export const PYDOCLINT_DEFAULT_STYLE = 'numpy';

export const PYDOCLINT_COMMAND = ['pydoclint', '--allow-init-docstring', 'true', '--quiet', '{files}'] as const;

export const BROKEN_CONTRACT = /^(?<name>.+?) BROKEN(?: \(| \[|$)/u;

export const PIP_INSTALL = /\bpip3? install\b/u;

export const INSTALL_EXTENSIONS = ['.sh', '.bash', '.yml', '.yaml', '.toml', 'Dockerfile'] as const;

export const PLACEHOLDERS = new Set(['todo', 'docstring', 'tbd', 'fixme', 'description', 'summary']);

/** These checks repeat annotations in prose unless the project opts into them. */
export const PYDOCLINT_TYPE_OPTIONS = [
    'arg-type-hints-in-docstring',
    'check-return-types',
    'check-yield-types',
] as const;

export const GOOGLE_DOCSTRING = /^[ \t]*(?:Args|Arguments|Keyword Args):[ \t]*$/mu;

export const NUMPY_DOCSTRING = /^[ \t]*Parameters[ \t]*\r?\n[ \t]*-{3,}[ \t]*$/mu;

/** Import-linter precedence: INI configurations first, then the Python project table. */
export const IMPORT_LINTER_FILES = ['setup.cfg', '.importlinter', PYPROJECT_TOML] as const;

export const DOCSTRING_STYLES = ['google', 'numpy', 'sphinx'] as const;

export const PYDOCLINT_STYLE_FLAG = '--style';

export const DEPTRY_EXCLUDE_FLAG = '--extend-exclude';
export const DEPTRY_FIRST_PARTY_FLAG = '--known-first-party';

export const NON_WORD_RUN = /[^a-z\d]+/gu;

export const DEPTRY_COMMAND = ['deptry', '.', '--no-ansi'] as const;

export const LINT_IMPORTS_COMMAND = ['lint-imports', '--no-cache', '--verbose', '--config'] as const;

export const VULTURE_COMMAND = ['vulture'] as const;

/** The exit code of a vulture run that found dead code. */
export const VULTURE_DEAD_CODE = 3;

/**
 * A line of vulture output that gspot reports: an unused definition, or unreachable code. Ruff already reports unused
 * imports and variables, so their lines stay out.
 */
export const VULTURE_FINDING =
    /^(?<file>.+?):(?<line>\d+): (?:unused (?<kind>attribute|class|function|method|property) '(?<name>[^']+)'|unreachable code after '(?<statement>[^']+)') \(\d+% confidence/u;
