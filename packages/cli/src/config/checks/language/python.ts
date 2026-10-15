import { PYPROJECT_TOML } from '#cli/config/parsers/dependency-files.ts';

/** The pinned native tool reads unclassified docstrings as NumPy style. */
export const PYDOCLINT_DEFAULT_STYLE = 'numpy';

export const PYDOCLINT_COMMAND = ['pydoclint', '--allow-init-docstring', 'true', '--quiet', '{files}'] as const;

export const BROKEN_CONTRACT = /^(?<name>.+?) BROKEN(?: \(| \[|$)/u;

export const PIP_INSTALL = /\bpip3? install\b/u;

export const INSTALL_EXTENSIONS = ['.sh', '.bash', '.yml', '.yaml', '.toml', 'Dockerfile'] as const;

export const CLASS_CALL = /^[A-Z][A-Za-z\d]*\(/u;

export const DEFINITIONS = new Set(['function_definition', 'class_definition']);

export const INIT_PY = '__init__.py';

export const PLACEHOLDERS = new Set(['todo', 'docstring', 'tbd', 'fixme', 'description', 'summary']);

/** A comment that directs a tool rather than a reader, which must sit on the line it covers. */

/** These checks repeat annotations in prose unless the project opts into them. */
export const PYDOCLINT_TYPE_OPTIONS = [
    'arg-type-hints-in-docstring',
    'check-return-types',
    'check-yield-types',
] as const;

export const GOOGLE_DOCSTRING = /^[ \t]*(?:Args|Arguments|Keyword Args):[ \t]*$/mu;

export const NUMPY_DOCSTRING = /^[ \t]*Parameters[ \t]*\r?\n[ \t]*-{3,}[ \t]*$/mu;

/** Native import-linter precedence: INI configurations first, then the Python project table. */
export const IMPORT_LINTER_FILES = ['setup.cfg', '.importlinter', PYPROJECT_TOML] as const;

export const DOCSTRING_STYLES = ['google', 'numpy', 'sphinx'] as const;

export const PYDOCLINT_STYLE_FLAG = '--style';

export const DEPTRY_EXCLUDE_FLAG = '--extend-exclude';

export const PYTHON_PRIVATE_PREFIX = '_';

export const DUNDER_PREFIX = '__';

export const NON_WORD_RUN = /[^a-z\d]+/gu;

export const DEPTRY_COMMAND = ['deptry', '.', '--no-ansi'] as const;

export const LINT_IMPORTS_COMMAND = ['lint-imports', '--no-cache', '--verbose', '--config'] as const;
