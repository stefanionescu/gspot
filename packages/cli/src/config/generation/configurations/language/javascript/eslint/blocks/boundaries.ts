export const TEST_BOUNDARY_CATEGORY = 'tests';

export const OTHER_BOUNDARY_ELEMENTS = [{ type: 'other', pattern: '**', partialMatch: false }] as const;

export const TEST_IMPORT_POLICY = {
    from: { file: { categories: { noneOf: [TEST_BOUNDARY_CATEGORY] } } },
    disallow: { to: { file: { categories: TEST_BOUNDARY_CATEGORY } } },
} as const;

export const OTHER_BOUNDARY_FILE = { category: 'other', pattern: ['**/*'] } as const;

export const TRPC_SERVER_CATEGORY = 'trpc:server';

export const TRPC_SERVER_VALUE_POLICY = {
    from: { file: [{ isUnknown: true }, { categories: { noneOf: [TRPC_SERVER_CATEGORY] } }] },
    disallow: { to: { file: { categories: TRPC_SERVER_CATEGORY } }, dependency: { kind: 'value' } },
} as const;

export const TEMPLATE_OPEN_ESCAPED = String.raw`\{{`;

export const TEMPLATE_OPEN = '{{';

export const BOUNDARY_OWNER_TEMPLATE = '{{to.file.categories.[0]}}';

export const BOUNDARY_SOURCE_TEMPLATE = '{{dependency.source}}';

export const UNKNOWN_IMPORT_POLICIES = [
    { from: { file: { isUnknown: true } }, allow: { to: { file: { path: '**/*' } } } },
    { allow: { to: { file: { isUnknown: true } } } },
] as const;

export const BOUNDARY_DEPENDENCY_SELECTORS = [
    {
        selector:
            'ImportDeclaration:not([importKind=type]):matches([specifiers.length=0], :has(ImportSpecifier:not([importKind=type]), ImportDefaultSpecifier, ImportNamespaceSpecifier)) > Literal',
        kind: 'value',
        name: 'import',
    },
    {
        selector:
            'ImportDeclaration:matches([importKind=type], [specifiers.length>0]:not(:has(ImportSpecifier:not([importKind=type]), ImportDefaultSpecifier, ImportNamespaceSpecifier))) > Literal',
        kind: 'type',
        name: 'import',
    },
    {
        selector:
            ':matches(ExportAllDeclaration:not([exportKind=type]), ExportNamedDeclaration:not([exportKind=type]):matches([specifiers.length=0], :has(ExportSpecifier:not([exportKind=type])))) > Literal',
        kind: 'value',
        name: 'export',
    },
    {
        selector:
            ':matches(ExportAllDeclaration[exportKind=type], ExportNamedDeclaration:matches([exportKind=type], [specifiers.length>0]:not(:has(ExportSpecifier:not([exportKind=type]))))) > Literal',
        kind: 'type',
        name: 'export',
    },
] as const;

export const BOUNDARY_DEPENDENCY_NODES = ['require', 'dynamic-import'] as const;

export const TRPC_CONFIGURATION = 'trpc';

export const IMPORT_RULE_CATEGORY = 'import-rule:';
