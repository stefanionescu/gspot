export const BASEDPYRIGHT_LEVELS = { basic: 'recommended', all: 'all' } as const;

export const BASEDPYRIGHT_ALL_LEVEL_OPTIONS = {
    reportImportCycles: 'error',
    reportImplicitOverride: 'error',
} as const;

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
    reportPropertyTypeMismatch: 'error',
    reportMissingTypeStubs: 'none',
    reportImportCycles: 'none',
    reportUnusedClass: 'error',
    reportUnusedFunction: 'error',
    reportDuplicateImport: 'error',
    reportWildcardImportFromLibrary: 'none',
    reportUntypedFunctionDecorator: 'error',
    reportUntypedClassDecorator: 'error',
    reportUntypedBaseClass: 'error',
    reportUntypedNamedTuple: 'error',
    reportTypeCommentUsage: 'none',
    reportPrivateImportUsage: 'none',
    reportDeprecated: 'error',
    reportMissingSuperCall: 'none',
    reportUnknownParameterType: 'error',
    reportUnknownArgumentType: 'error',
    reportUnknownLambdaType: 'error',
    reportUnknownVariableType: 'error',
    reportUnknownMemberType: 'error',
    reportMissingParameterType: 'none',
    reportMissingTypeArgument: 'none',
    reportInvalidTypeVarUse: 'error',
    reportCallInDefaultInitializer: 'none',
    reportUnnecessaryIsInstance: 'error',
    reportUnnecessaryCast: 'error',
    reportUnnecessaryComparison: 'error',
    reportUnnecessaryContains: 'error',
    reportImplicitStringConcatenation: 'none',
    reportInvalidStubStatement: 'error',
    reportIncompleteStub: 'error',
    reportUnsupportedDunderAll: 'error',
    reportUnusedCallResult: 'none',
    reportUnusedCoroutine: 'error',
    reportUnusedExpression: 'error',
    reportUnnecessaryTypeIgnoreComment: 'error',
    reportMatchNotExhaustive: 'error',
    reportImplicitOverride: 'none',
    reportUnreachable: 'error',
    reportAny: 'none',
    reportExplicitAny: 'none',
    reportPrivateLocalImportUsage: 'none',
    reportImplicitRelativeImport: 'none',
    reportUnusedParameter: 'none',
    reportUnannotatedClassAttribute: 'none',
    reportIncompatibleUnannotatedOverride: 'error',
    reportInvalidAbstractMethod: 'error',
    reportSelfClsDefault: 'error',
    reportEmptyAbstractUsage: 'error',
} as const;

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

export const RUFF_TABLE = 'tools.ruff';

export const RUFF_CHECK = 'python/ruff';

export const BASEDPYRIGHT_CHECK = 'python/basedpyright';
