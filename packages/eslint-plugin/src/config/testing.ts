// mocha constructs
export const MOCHA_CONSTRUCTS = new Set([
    'describe',
    'context',
    'it',
    'specify',
    'before',
    'after',
    'beforeAll',
    'afterAll',
    'beforeEach',
    'afterEach',
]);

// no-async-suite-callbacks rule
export const ASYNC_SUITE_MODIFIERS = new Set(['only', 'each']);
export const ASYNC_SUITE_MODULES = ['jest', '@jest/globals', 'mocha', 'cypress'];
export const ASYNC_SUITE_ORIGINS = new Set([undefined, 'jest', '@jest/globals', 'mocha']);

// no-exclusive-tests rule
export const EXCLUSIVE_TEST_NAMES = new Set(['context', 'describe', 'it', 'specify', 'test']);

// no-forced-ui-actions rule
export const CYPRESS_ACTIONS: ReadonlyMap<string | null, number> = new Map([
    ['click', 0],
    ['check', 0],
    ['clear', 0],
    ['dblclick', 0],
    ['rightclick', 0],
    ['select', 1],
    ['trigger', 1],
    ['type', 1],
    ['uncheck', 0],
]);
export const PLAYWRIGHT_ACTIONS: ReadonlyMap<string | null, number> = new Map([
    ['check', 0],
    ['clear', 0],
    ['click', 0],
    ['dblclick', 0],
    ['dragTo', 1],
    ['fill', 1],
    ['hover', 0],
    ['selectOption', 1],
    ['selectText', 0],
    ['setChecked', 1],
    ['tap', 0],
    ['uncheck', 0],
]);

// no-nested-vitest-mock rule
export const VITEST_GLOBAL_ORIGINS = new Set([undefined, 'vitest']);
export const VITEST_IMPORT_ORIGINS = new Set<string | undefined>(['vitest']);
export const VITEST_MOCK_RECEIVERS = new Set(['vi', 'vitest']);

// no-overflowing-test-timeout rule
export const MAXIMUM_TIMER_DELAY = 2_147_483_647;

// no-test-retries rule
export const RETRY_MODULES = ['jest', '@jest/globals'];

// no-ui-test-debugging rule
export const DEBUG_METHODS: ReadonlyMap<string | null, readonly string[]> = new Map([
    ['pause', ['cypress', 'page']],
    ['debug', ['cypress', 'library']],
    ['logTestingPlaygroundURL', ['library']],
]);
export const DEBUG_ROOTS = new Set(['cy', 'page', 'screen']);
export const TESTING_LIBRARY_DEBUGGERS = [
    'screen.debug',
    'screen.logTestingPlaygroundURL',
    'render.debug',
    'prettyDOM',
    'logRoles',
];

// playwright locators
export const PLAYWRIGHT_LOCATOR = /^(?:(?:locator|frameLocator)$|getBy)/u;

// test frameworks
export const CALL_STEP = '()';
export const JASMINE_PACKAGES = ['jasmine', 'jasmine-core', 'jasmine-node', 'karma-jasmine'] as const;
export const MARKED_TEST_MODIFIERS = new Set(['only', 'skip']);
export const PLAYWRIGHT_SUITE_MODES: ReadonlySet<string | null> = new Set(['parallel', 'serial']);
export const RUNNING_TEST_MODIFIERS = new Set([
    'only',
    'concurrent',
    'failing',
    'sequential',
    'fails',
    'fail',
    'parallel',
    'serial',
]);
export const TABLE_DEPENDENCIES = ['jest', 'vitest'];
export const TABLE_MODULES = ['bun:test', 'jest', '@jest/globals', 'vitest'];
export const TABLE_ORIGINS: ReadonlySet<string | undefined> = new Set(TABLE_MODULES);
export const TABLE_TEST_NAMES = new Set(['test', 'it', 'describe', 'suite']);
export const TEST_FILE_EXTENSIONS = ['js', 'mjs', 'cjs', 'jsx', 'vue', 'ts', 'mts', 'cts', 'tsx'];
export const TEST_FILE_MARKERS = ['test', 'spec', 'cy', 'e2e', 'mock'];
export const TEST_FOLDERS = new Set(['__tests__', '__mocks__']);
export const TEST_FRAMEWORK_MODULES = new Set([
    'bun:test',
    'jest',
    '@jest/globals',
    'mocha',
    'node:test',
    'vitest',
    '@playwright/test',
]);
export const TEST_KINDS = new Map<string, 'test' | 'suite' | 'hook'>([
    ['it', 'test'],
    ['specify', 'test'],
    ['test', 'test'],
    ['describe', 'suite'],
    ['context', 'suite'],
    ['suite', 'suite'],
    ['fdescribe', 'suite'],
    ['before', 'hook'],
    ['after', 'hook'],
    ['beforeAll', 'hook'],
    ['afterAll', 'hook'],
    ['beforeEach', 'hook'],
    ['afterEach', 'hook'],
]);

// no-early-test-return rule
export const EARLY_RETURN_DEPENDENCIES = [
    { framework: undefined, modules: ['jest', '@jest/globals'], dependencies: ['jest'] },
    { framework: undefined, modules: [...JASMINE_PACKAGES], dependencies: [...JASMINE_PACKAGES] },
    { framework: undefined, modules: ['ava'], dependencies: ['ava'] },
    { framework: undefined, modules: ['qunit'], dependencies: ['qunit'] },
    { framework: 'playwright', modules: ['@playwright/test'], dependencies: ['@playwright/test'] },
    { framework: 'vitest', modules: ['vitest'], dependencies: ['vitest'] },
    { framework: 'mocha', modules: ['mocha'], dependencies: ['mocha'] },
] as const;
export const EARLY_RETURN_GUARD = [
    ':function > BlockStatement[body.length>1] > IfStatement:first-child[alternate=null]',
    ':matches([consequent.type="ReturnStatement"][consequent.argument=null], [consequent.body.length=1][consequent.body.0.type="ReturnStatement"][consequent.body.0.argument=null])',
].join('');
export const EARLY_RETURN_IMPORTS = [
    { framework: 'playwright', modules: ['@playwright/test'] },
    { framework: 'nodeTest', modules: ['node:test'] },
    { framework: 'bun', modules: ['bun:test'] },
    { framework: 'vitest', modules: ['vitest'] },
    { framework: 'mocha', modules: ['mocha'] },
] as const;
const PLAYWRIGHT_TEST_MODIFIERS = new Set(['only', 'fail']);
export const EARLY_RETURN_MODIFIERS = {
    mocha: RUNNING_TEST_MODIFIERS,
    vitest: RUNNING_TEST_MODIFIERS,
    playwright: PLAYWRIGHT_TEST_MODIFIERS,
    nodeTest: new Set(['only']),
    bun: new Set(['only']),
};
export const PLAYWRIGHT_MODULE = '@playwright/test';

// no-empty-test-file rule
export const TEST_DECLARATIONS = new Set([
    ...['it', 'test'].flatMap((name) =>
        [
            '',
            '.concurrent',
            '.concurrent.only',
            '.concurrent.skip',
            '.concurrent.each',
            '.concurrent.only.each',
            '.concurrent.skip.each',
            '.each',
            '.failing',
            '.failing.each',
            '.only.failing',
            '.skip.failing',
            '.only',
            '.only.each',
            '.skip.each',
            '.todo',
            '.runIf',
            '.skipIf',
            '.fails',
            '.fails.each',
            '.sequential',
            '.sequential.each',
            '.for',
            '.prop',
        ].map((suffix) => name + suffix),
    ),
    'it.skip',
    'fit',
    'xit',
    'specify',
    'specify.skip',
    'specify.only',
    'xspecify',
    'ruleTester.run',
    'Deno.test',
    'Deno.test.only',
    'Deno.test.ignore',
]);
export const TEST_FILE_PATTERN = new RegExp(
    String.raw`\.(?:test|spec|cy)\.(?:${TEST_FILE_EXTENSIONS.join('|')})$`,
    'u',
);
export const TITLED_TEST_DECLARATIONS = new Set(['test.skip', 'test.fail', 'test.fail.only', 'test.fixme']);

// no-nested-functions rule
export const TEST_STRUCTURE_CALLS = new Set([
    ...TEST_KINDS.keys(),
    ...['describe', 'context', 'it', 'test'].flatMap((name) => [`x${name}`, `f${name}`]),
]);

// no-unexplained-test-skips rule
export const EXPLANATION_LETTER = /\p{L}/u;
export const NODE_TEST_MODULES = new Set([undefined, 'node:test']);
export const SKIPPED_TEST_CALLS = {
    jasmine: { skipped: [], disabled: ['xit', 'xdescribe', 'xcontext'] },
    jest: { skipped: ['test', 'it', 'describe'], disabled: ['xtest', 'xit', 'xdescribe'] },
    vitest: { skipped: ['it', 'test', 'describe', 'suite'], disabled: [] },
    mocha: {
        skipped: ['it', 'describe', 'context', 'specify'],
        disabled: ['xit', 'xdescribe', 'xcontext', 'xspecify'],
    },
    playwright: { skipped: [], disabled: [] },
} as const;
export const SKIP_FRAMEWORKS = [
    { framework: 'jasmine', dependencies: [...JASMINE_PACKAGES] },
    { framework: 'jest', dependencies: ['jest'] },
    { framework: 'vitest', dependencies: ['vitest'] },
    { framework: 'mocha', dependencies: ['mocha', 'cypress'] },
    { framework: 'playwright', dependencies: ['@playwright/test'] },
] as const;

// prefer-test-table rule
export const CONCRETE_TEST_MODIFIERS = new Set([
    'only',
    'concurrent',
    'failing',
    'fail',
    'slow',
    'fails',
    'sequential',
]);
export const GLOBAL_TEST_BLOCKERS = ['cypress', ...JASMINE_PACKAGES, 'mocha'];
export const SIMILAR_TEST_LIMITS = { tests: 3, statements: 2, parameters: 3 };
export const SIMILAR_TEST_MODULES = [
    { modules: ['jest', '@jest/globals'], dependencies: ['jest'], isGlobal: true },
    { modules: ['vitest'], dependencies: ['vitest'], isGlobal: true },
    { modules: ['@playwright/test'], dependencies: ['@playwright/test'], isGlobal: false },
    { modules: ['bun:test'], dependencies: ['bun:test'], isGlobal: false },
] as const;
export const SIMILAR_TEST_NAMES = new Set(['it', 'test']);
export const SIMILAR_TEST_ORIGINS = new Set(['bun:test', 'jest', '@jest/globals', 'vitest', '@playwright/test']);

// test table calls
export const TABLE_CALL =
    'CallExpression[callee.type="CallExpression"][callee.callee.type="MemberExpression"][callee.callee.property.name="each"][arguments.length>1]';

// test-hooks-first rule
export const TEST_AFTER_HOOK_NAMES = new Set(['after', 'afterAll', 'afterEach']);

// testing library
export const TESTING_LIBRARY_MODULES = [
    '@testing-library/dom',
    '@testing-library/react',
    '@testing-library/vue',
    '@testing-library/angular',
    '@testing-library/svelte',
    '@testing-library/preact',
];

// testing-library-queries rule
export const ALL_QUERY_METHOD = /^(?:get|query)AllBy[A-Z]/u;
export const PRESENCE_MATCHERS: ReadonlySet<string | null> = new Set([
    'toBeInTheDocument',
    'toBeTruthy',
    'toBeDefined',
]);
export const QUERY_ASSERTION =
    'CallExpression[arguments.length=0][callee.type="MemberExpression"][callee.property.name=/^(?:toBeInTheDocument|toBeTruthy|toBeDefined|toBeNull|toBeFalsy)$/]';
export const QUERY_METHOD = /^(?:get|query|find)(?:All)?By[A-Z]/u;
export const REMOVAL_CALLBACK = [
    'CallExpression > CallExpression.arguments:first-child',
    'CallExpression > ArrowFunctionExpression.arguments:first-child[async=false] > CallExpression.body',
    'CallExpression > :matches(ArrowFunctionExpression, FunctionExpression).arguments:first-child[async=false][generator=false] > BlockStatement.body[body.length=1] > ReturnStatement > CallExpression.argument',
].join(', ');
