const STORE = {
    selector: 'CallExpression[callee.name=/Store$/]',
    message: 'Pass a selector to the store hook.',
} as const;

const RAW_SQL = {
    selector: "TaggedTemplateExpression[tag.name='sql']",
    message: 'Use the query builder.',
} as const;

const PROCEDURE = {
    selector: "CallExpression[callee.property.name='query']",
    message: 'Give the procedure an input.',
} as const;

const INJECTED = {
    selector: "Decorator[expression.callee.name='InjectRepository']",
    message: 'Inject the service.',
} as const;

export const RESPONSE_MESSAGES =
    'response.json({ message: `Item ${identifier}` });\ncustom.info(`Item ${identifier}`);\n';

export const ALIAS_IMPORT = 'import value from "#owner";\n';

export const SCOPE_CONFIGURATIONS = ['javascript', 'react'] as const;

export const SELECTOR_GROUP_CASES = [
    {
        name: 'general selectors apply in first-mention order',
        selectors: [STORE, PROCEDURE],
        expected: [{ selectors: [STORE, PROCEDURE] }],
    },
    {
        name: 'an allowed path set excludes its selector',
        selectors: [STORE, { ...RAW_SQL, ignores: ['db/migrations/**'] }],
        expected: [
            { files: [['db/migrations/**']], selectors: [STORE] },
            { ignores: ['db/migrations/**'], selectors: [STORE, RAW_SQL] },
        ],
    },
    {
        name: 'specific file selectors combine with general selectors',
        selectors: [
            STORE,
            { ...INJECTED, files: ['**/*.controller.ts'] },
            { ...PROCEDURE, files: ['**/routers/**/*.ts'] },
            { ...RAW_SQL, files: ['**/*.controller.ts'] },
        ],
        expected: [
            { files: [['**/*.controller.ts', '**/routers/**/*.ts']], selectors: [STORE, INJECTED, PROCEDURE, RAW_SQL] },
            { files: [['**/*.controller.ts']], ignores: ['**/routers/**/*.ts'], selectors: [STORE, INJECTED, RAW_SQL] },
            { files: [['**/routers/**/*.ts']], ignores: ['**/*.controller.ts'], selectors: [STORE, PROCEDURE] },
            { ignores: ['**/*.controller.ts', '**/routers/**/*.ts'], selectors: [STORE] },
        ],
    },
    {
        name: 'an empty allowed list adds no group',
        selectors: [RAW_SQL],
        expected: [{ selectors: [RAW_SQL] }],
    },
];
