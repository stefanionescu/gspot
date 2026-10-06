/** Native Knip rows with individual and grouped diagnostics. */
export const KNIP_REPORT = {
    issues: [
        {
            file: 'space name.ts',
            owners: [{ name: '@project' }],
            binaries: [{ name: 'missing-tool' }],
            catalog: [{ name: 'catalog-package' }],
            catalogReferences: [{ name: 'catalog:missing' }],
            cycles: [
                [
                    { name: 'first', line: 1, col: 2 },
                    { name: 'second', line: 3, col: 4 },
                ],
            ],
            dependencies: [{ name: 'unused-package' }],
            devDependencies: [{ name: 'unused-development-package' }],
            duplicates: [
                [
                    { name: 'alias', line: 5, col: 6 },
                    { name: 'original', line: 7, col: 8 },
                ],
            ],
            enumMembers: [{ name: 'Unused', namespace: 'Status', line: 9, col: 10 }],
            exports: [{ name: 'unused', line: 11, col: 12, pos: 100 }],
            files: [{ name: 'space name.ts' }],
            namespaceMembers: [{ name: 'member', namespace: 'Outer' }],
            nsExports: [{ name: 'namespaceExport' }],
            nsTypes: [{ name: 'NamespaceType' }],
            optionalPeerDependencies: [{ name: 'optional-package' }],
            types: [{ name: 'UnusedType' }],
            unlisted: [{ name: 'missing-package', kind: 'import', specifier: 'missing-package/subpath' }],
            unresolved: [{ name: './missing.js' }],
        },
    ],
};

/** Categories stay visible independently of their file and symbol. */
export const KNIP_EXPECTED = [
    { rule: 'binaries', message: 'Unlisted binary: missing-tool' },
    { rule: 'catalog', message: 'Unused catalog entry: catalog-package' },
    { rule: 'catalogReferences', message: 'Unresolved catalog reference: catalog:missing' },
    { rule: 'cycles', message: 'Circular dependency: first, second', line: 1, column: 2 },
    { rule: 'cycles', message: 'Circular dependency: first, second', line: 3, column: 4 },
    { rule: 'dependencies', message: 'Unused dependency: unused-package' },
    { rule: 'devDependencies', message: 'Unused development dependency: unused-development-package' },
    { rule: 'duplicates', message: 'Duplicate export: alias, original', line: 5, column: 6 },
    { rule: 'duplicates', message: 'Duplicate export: alias, original', line: 7, column: 8 },
    { rule: 'enumMembers', message: 'Unused exported enum member: Unused (Status)', line: 9, column: 10 },
    { rule: 'exports', message: 'Unused export: unused', line: 11, column: 12 },
    { rule: 'files', message: 'Unused file: space name.ts' },
    { rule: 'namespaceMembers', message: 'Unused exported namespace member: member (Outer)' },
    { rule: 'nsExports', message: 'Export in used namespace: namespaceExport' },
    { rule: 'nsTypes', message: 'Exported type in used namespace: NamespaceType' },
    { rule: 'optionalPeerDependencies', message: 'Referenced optional peer dependency: optional-package' },
    { rule: 'types', message: 'Unused exported type: UnusedType' },
    { rule: 'unlisted', message: 'Unlisted dependency: missing-package' },
    { rule: 'unresolved', message: 'Unresolved import: ./missing.js' },
];

/** Invalid boundary payloads must fail instead of dropping diagnostics. */
export const INVALID_KNIP_REPORTS = [
    'not JSON',
    '{}',
    '{"issues":{}}',
    '{"issues":[{"file":""}]}',
    '{"issues":[{"file":"source.js","unknown":[{"name":"lost"}]}]}',
    '{"issues":[{"file":"source.js","exports":[{"name":1}]}]}',
    '{"issues":[{"file":"source.js","exports":[{"name":"value","line":0}]}]}',
    '{"issues":[{"file":"source.js","duplicates":[{"name":"value"}]}]}',
];
