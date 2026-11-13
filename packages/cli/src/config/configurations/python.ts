// deptry check

export const DEPTRY_COMMAND = ['deptry', '.', '--no-ansi'] as const;
export const DEPTRY_EXCLUDE_FLAG = '--extend-exclude';
export const DEPTRY_FIRST_PARTY_FLAG = '--known-first-party';
export const NO_PYPROJECT_NOTE = 'This scope has no pyproject.toml for deptry to read.';
export const PROJECT_NAME_SEPARATORS = /[-.]+/gu;
export const PYTHON_SOURCE_FOLDER = 'src';
export const UV_RUN_ARGUMENTS = ['run', '--no-sync'] as const;

// function-size check
export const PYTHON_RULES = {
    functionLines: 'function-lines',
    requirementsFile: 'requirements-file',
    pipInstall: 'pip-install',
    placeholderDocstring: 'placeholder-docstring',
    unreachableCode: 'unreachable-code',
} as const;

// generated config
export const BASEDPYRIGHT_ALL_LEVEL_OPTIONS = {
    reportUnusedClass: 'none',
    reportUnusedFunction: 'none',
} as const;
export const BASEDPYRIGHT_CHECK = 'python/basedpyright';
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
export const MINIMUM_PYTHON = /(?:>=|~=|==)\s*(?<version>\d+\.\d+)/u;
export const PYDANTIC_PACKAGE = 'pydantic';
export const PYTHON_FILES = ['**/*.py'] as const;
export const RUFF_CHECK = 'python/ruff';
export const RUFF_CONSOLE_RULES = ['T20'] as const;
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
export const RUFF_RUNTIME_TYPES = {
    'runtime-evaluated-base-classes': ['pydantic.BaseModel', 'pydantic_settings.BaseSettings'],
    'runtime-evaluated-decorators': ['fastapi.FastAPI', 'fastapi.APIRouter'].flatMap((owner) =>
        ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'api_route', 'websocket'].map(
            (method) => `${owner}.${method}`,
        ),
    ),
} as const;
export const RUFF_TIDY_IMPORTS = {
    'ban-relative-imports': 'parents',
    'banned-api': {
        'importlib.import_module': { msg: 'Import the module by name at the top of the file.' },
        'builtins.__import__': { msg: 'Import the module by name at the top of the file.' },
    },
} as const;
// F401 reports a side-effect import as unused, such as import readline, and its fix deletes the import.
export const RUFF_UNFIXABLE = ['F401'];

// pip-installs check
export const INSTALL_FILE_SUFFIXES = ['.sh', '.bash', '.yml', '.yaml', '.toml', 'Dockerfile'] as const;
export const NO_LOCKFILE_NOTE = 'This check needs uv.lock, poetry.lock, or pdm.lock in this scope.';
export const PIP_INSTALL = /\bpip3? install\b/u;
export const PIP_INSTALL_MESSAGE = 'Add the package to pyproject.toml and install it from the lockfile.';
export const REQUIREMENTS_FILE_MESSAGE =
    'A hand-kept requirements file is a second owner of the dependencies. Export it from the lockfile and declare it generated, or delete it.';
export const REQUIREMENTS_FOLDER_FILE = /(?:^|\/)requirements\/[^/]+\.txt$/u;

// placeholder-docstrings check
export const CLASS_DOCSTRING_OPENING = /^(?:class that|class for|a class)\b/u;
export const NON_WORD_RUN = /[^a-z\d]+/gu;
export const PLACEHOLDERS = new Set(['todo', 'docstring', 'tbd', 'fixme', 'description', 'summary']);

// pydoclint check
export const GOOGLE_DOCSTRING =
    /^[ \t]*(?:Args|Arguments|Keyword Args|Keyword Arguments|Attributes|Returns|Yields|Raises):[ \t]*$/mu;
export const NUMPY_DOCSTRING = /^[ \t]*Parameters[ \t]*\r?\n[ \t]*-{3,}[ \t]*$/mu;
export const PYDOCLINT_ALL_LEVEL_OPTIONS = ['skip-checking-short-docstrings'] as const;
export const PYDOCLINT_COMMAND = ['pydoclint', '--allow-init-docstring', 'true', '--quiet', '{files}'] as const;
export const PYDOCLINT_DEFAULT_STYLE = 'numpy';
export const PYDOCLINT_STYLE_FLAG = '--style';
export const PYDOCLINT_TYPE_OPTIONS = [
    'arg-type-hints-in-docstring',
    'check-return-types',
    'check-yield-types',
] as const;
export const RAISES_MISMATCH_HELP =
    'Under `Raises:`, list each name that the finding prints for the body. pydoclint reads the name that follows `raise`, so for `raise build_error(...)` or `raise error` it expects the function or the variable, not the exception class.';
export const RAISES_MISMATCH_RULE = 'DOC503';

// pytest
export const COVERAGE_INI_SECTION = /^[\t ]*\[coverage:run\][\t ]*\r?$/mu;
export const NON_PYTHON_TEST_PATTERNS: ReadonlySet<string> = new Set([
    '**/*.test.*',
    '**/*.spec.*',
    '**/*Tests.swift',
    '**/__tests__/**',
]);

// vulture check
export const VULTURE_COMMAND = [
    'vulture',
    '--ignore-decorators',
    '@*.get,@*.post,@*.put,@*.patch,@*.delete,@*.head,@*.options,@*.api_route,@*.route,@*.websocket',
] as const;
export const VULTURE_DEAD_CODE = 3;
export const VULTURE_FINDING =
    /^(?<file>.+?):(?<line>\d+): (?:unused (?<kind>attribute|class|function|method|property) '(?<name>[^']+)'|unreachable code after '(?<statement>[^']+)') \(\d+% confidence/u;
