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
    ['before', 'hook'],
    ['after', 'hook'],
    ['beforeAll', 'hook'],
    ['afterAll', 'hook'],
    ['beforeEach', 'hook'],
    ['afterEach', 'hook'],
]);

export const CALL_STEP = '()';

export const TEST_AFTER_HOOK_NAMES = new Set(['after', 'afterAll', 'afterEach']);

export const PLAYWRIGHT_MODULE = '@playwright/test';

export const NODE_TEST_MODULES = new Set([undefined, 'node:test']);

export const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

export const PACKAGE_MANIFEST = 'package.json';

export const REPOSITORY_MARKER = '.git';

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

export const MARKED_TEST_MODIFIERS = new Set(['only', 'skip']);

const PLAYWRIGHT_TEST_MODIFIERS = new Set(['only', 'fail']);

export const PLAYWRIGHT_SUITE_MODES = new Set(['parallel', 'serial']);

export const EXCLUSIVE_TEST_NAMES = new Set(['context', 'describe', 'it', 'specify', 'test']);

export const EXPLANATION_LETTER = /\p{L}/u;

export const SKIP_FRAMEWORKS = [
    { framework: 'jasmine', dependencies: ['jasmine'] },
    { framework: 'jest', dependencies: ['jest'] },
    { framework: 'vitest', dependencies: ['vitest'] },
    { framework: 'mocha', dependencies: ['mocha', 'cypress'] },
    { framework: 'playwright', dependencies: ['@playwright/test'] },
] as const;

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

export const EARLY_RETURN_IMPORTS = [
    { framework: 'playwright', modules: ['@playwright/test'] },
    { framework: 'nodeTest', modules: ['node:test'] },
    { framework: 'bun', modules: ['bun:test'] },
    { framework: 'vitest', modules: ['vitest'] },
    { framework: 'mocha', modules: ['mocha'] },
] as const;

export const EARLY_RETURN_DEPENDENCIES = [
    { framework: undefined, modules: ['jest', '@jest/globals'], dependencies: ['jest'] },
    {
        framework: undefined,
        modules: ['jasmine', 'jasmine-core', 'jasmine-node', 'karma-jasmine'],
        dependencies: ['jasmine', 'jasmine-core', 'jasmine-node', 'karma-jasmine'],
    },
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

export const EARLY_RETURN_MODIFIERS = {
    mocha: RUNNING_TEST_MODIFIERS,
    vitest: RUNNING_TEST_MODIFIERS,
    playwright: PLAYWRIGHT_TEST_MODIFIERS,
    nodeTest: new Set(['only']),
    bun: new Set(['only']),
};
