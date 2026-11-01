export const PYTHON_CONFIGURATION = 'python';

export const COVERAGE_INI_SECTION = /^[\t ]*\[coverage:run\][\t ]*\r?$/mu;

export const BASEDPYRIGHT_LEVELS = { basic: 'recommended', all: 'all' } as const;

export const BASEDPYRIGHT_OPTIONS = {
    strictParameterNoneValue: false,
    enableTypeIgnoreComments: true,
    deprecateTypingAliases: false,
    failOnWarnings: false,
    reportUnusedImport: 'none',
    reportUnusedVariable: 'none',
    reportRedeclaration: 'none',
    reportPrivateUsage: 'none',
    reportSelfClsParameterName: 'none',
    reportUndefinedVariable: 'none',
    reportIgnoreCommentWithoutRule: 'none',
    reportMissingTypeStubs: 'none',
    reportWildcardImportFromLibrary: 'none',
    reportTypeCommentUsage: 'none',
    reportPrivateImportUsage: 'none',
    reportMissingSuperCall: 'none',
    reportMissingParameterType: 'none',
    reportMissingTypeArgument: 'none',
    reportCallInDefaultInitializer: 'none',
    reportImplicitStringConcatenation: 'none',
    reportUnusedCallResult: 'none',
    reportAny: 'none',
    reportExplicitAny: 'none',
    reportPrivateLocalImportUsage: 'none',
    reportImplicitRelativeImport: 'none',
    reportUnusedParameter: 'none',
    reportUnannotatedClassAttribute: 'none',
} as const;

export const BASEDPYRIGHT_DEFAULT_OPTIONS = {
    reportPropertyTypeMismatch: 'error',
    reportImportCycles: 'none',
    reportUnusedClass: 'error',
    reportUnusedFunction: 'error',
    reportDuplicateImport: 'error',
    reportUntypedFunctionDecorator: 'error',
    reportUntypedClassDecorator: 'error',
    reportUntypedBaseClass: 'error',
    reportUntypedNamedTuple: 'error',
    reportDeprecated: 'error',
    reportUnknownParameterType: 'none',
    reportUnknownArgumentType: 'error',
    reportUnknownLambdaType: 'error',
    reportUnknownVariableType: 'error',
    reportUnknownMemberType: 'error',
    reportInvalidTypeVarUse: 'error',
    reportUnnecessaryIsInstance: 'error',
    reportUnnecessaryCast: 'error',
    reportUnnecessaryComparison: 'error',
    reportUnnecessaryContains: 'error',
    reportInvalidStubStatement: 'error',
    reportIncompleteStub: 'error',
    reportUnsupportedDunderAll: 'error',
    reportUnusedCoroutine: 'error',
    reportUnusedExpression: 'error',
    reportUnnecessaryTypeIgnoreComment: 'error',
    reportMatchNotExhaustive: 'error',
    reportImplicitOverride: 'none',
    reportUnreachable: 'error',
    reportIncompatibleUnannotatedOverride: 'error',
    reportInvalidAbstractMethod: 'error',
    reportSelfClsDefault: 'error',
    reportEmptyAbstractUsage: 'error',
} as const;

export const BASEDPYRIGHT_ALL_LEVEL_OPTIONS = {
    reportUnusedClass: 'none',
    reportUnusedFunction: 'none',
} as const;

export const PYTHON_FILES = ['**/*.py'] as const;

export const RUFF_ISORT = {
    'length-sort': true,
    'length-sort-straight': true,
    'force-sort-within-sections': true,
} as const;

export const RUFF_PATH_RULES = {
    '**/test_*.py': ['S101'],
    '**/*_test.py': ['S101'],
    '**/tests/**': ['S101'],
    '**/conftest.py': ['S101'],
    '**/__main__.py': ['T20'],
} as const;

export const RUFF_CONSOLE_RULES = ['T20'] as const;

export const RUFF_ALWAYS_OFF = [
    'COM812',
    'COM819',
    'D203',
    'D206',
    'D213',
    'D300',
    'D417',
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

export const RUFF_CHECK = 'python/ruff';

export const BASEDPYRIGHT_CHECK = 'python/basedpyright';

export const SQLFLUFF_CAPITALISATION = {
    'capitalisation.keywords': { capitalisation_policy: 'upper' },
    'capitalisation.identifiers': { extended_capitalisation_policy: 'lower' },
    'capitalisation.functions': { extended_capitalisation_policy: 'lower' },
    'capitalisation.literals': { capitalisation_policy: 'upper' },
    'capitalisation.types': { extended_capitalisation_policy: 'upper' },
} as const;

export const SQL_FILE_EXTENSIONS = '.sql,.pgsql,.psql';

export const SQL_FILES = ['**/*.sql', '**/*.pgsql', '**/*.psql'] as const;

export const SQLFLUFF_DEFAULT_LEVEL_OFF = ['AM05', 'AM09', 'CV11', 'ST05', 'ST07', 'ST09'] as const;

export const SQLFLUFF_CHECK = 'sql/sqlfluff';

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

export const PYDOCLINT_ALL_LEVEL_OPTIONS = ['skip-checking-short-docstrings'] as const;

export const PYDOCLINT_COMMAND = ['pydoclint', '--allow-init-docstring', 'true', '--quiet', '{files}'] as const;

export const PYDOCLINT_STYLE_FLAG = '--style';

export const PYDOCLINT_DEFAULT_STYLE = 'numpy';

export const VULTURE_FINDING =
    /^(?<file>.+?):(?<line>\d+): (?:unused (?<kind>attribute|class|function|method|property) '(?<name>[^']+)'|unreachable code after '(?<statement>[^']+)') \(\d+% confidence/u;

export const VULTURE_COMMAND = ['vulture'] as const;

export const VULTURE_DEAD_CODE = 3;

export const NO_LOCKFILE_NOTE = 'This check needs uv.lock, poetry.lock, or pdm.lock in this scope.';

export const REQUIREMENTS_FILE_MESSAGE =
    'A hand-kept requirements file is a second owner of the dependencies. Export it from the lockfile and declare it generated, or delete it.';

export const PIP_INSTALL_MESSAGE = 'Add the package to pyproject.toml and install it from the lockfile.';

export const NO_PYPROJECT_NOTE = 'This scope has no pyproject.toml for deptry to read.';

export const PYTHON_RULES = {
    functionLines: 'function-lines',
    requirementsFile: 'requirements-file',
    pipInstall: 'pip-install',
    placeholderDocstring: 'placeholder-docstring',
    unreachableCode: 'unreachable-code',
} as const;

export const REQUIREMENTS_FOLDER_FILE = /(?:^|\/)requirements\/[^/]+\.txt$/u;
