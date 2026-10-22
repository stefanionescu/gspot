export const TEST_BOUNDARY_CATEGORY = 'tests';

export const OTHER_BOUNDARY_ELEMENTS = [{ type: 'other', pattern: '**', partialMatch: false }] as const;

export const TEST_IMPORT_POLICY = {
    from: { file: { categories: { noneOf: [TEST_BOUNDARY_CATEGORY] } } },
    disallow: { to: { file: { categories: TEST_BOUNDARY_CATEGORY } } },
} as const;

export const OTHER_BOUNDARY_FILE = { category: 'other', pattern: ['**/*'] } as const;

/** The boundary category of the tRPC server files. */
export const TRPC_SERVER_CATEGORY = 'trpc:server';

/** The final policy refuses server values even when your own module rule permits the import. */
export const TRPC_SERVER_VALUE_POLICY = {
    from: { file: [{ isUnknown: true }, { categories: { noneOf: [TRPC_SERVER_CATEGORY] } }] },
    disallow: { to: { file: { categories: TRPC_SERVER_CATEGORY } }, dependency: { kind: 'value' } },
} as const;

export const TEMPLATE_OPEN_ESCAPED = String.raw`\{{`;

/** A rule name that holds {{ stays text in a boundaries message. */
export const TEMPLATE_OPEN = '{{';

export const BOUNDARY_OWNER_TEMPLATE = '{{to.file.categories.[0]}}';

export const BOUNDARY_SOURCE_TEMPLATE = '{{dependency.source}}';

/** Files that no boundary covers stay outside your own architecture policies. */
export const UNKNOWN_IMPORT_POLICIES = [
    { from: { file: { isUnknown: true } }, allow: { to: { file: { path: '**/*' } } } },
    { allow: { to: { file: { isUnknown: true } } } },
] as const;

/** Classify imports and exports as value or type by their specifiers. */
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

/** Count require calls and dynamic imports too. */
export const BOUNDARY_DEPENDENCY_NODES = ['require', 'dynamic-import'] as const;
