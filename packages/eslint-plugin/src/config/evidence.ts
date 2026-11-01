export const SCRIPT_ASSERTIONS = [
    /^chai\.(?:assert(?:\.|$)|expect$)/u,
    /^sinon\.assert\.[^.]+$/u,
    /^supertest\.[^.]+\.expect(?:\.|$)/u,
    /^uvu\/assert\./u,
    /^aws-cdk-lib\/assertions\.Template\.from(?:Stack|JSON|String)\.(?:resourceCountIs|resourcePropertiesCountIs|hasResourceProperties|hasResource|allResources|allResourcesProperties|hasParameter|hasOutput|hasMapping|hasCondition|templateMatches)$/u,
    /^aws-cdk-lib\/assertions\.Annotations\.fromStack\.has(?:No)?(?:Error|Warning|Info)$/u,
    /^aws-cdk-lib\/assertions\.Tags\.fromStack\.has(?:Values|None)$/u,
];

export const RUNNER_ASSERTION = /^(?:vitest|bun:test)\.expect(?:\.|$)/u;

export const TYPE_ASSERTION = /^(?:vitest\.(?:expectTypeOf|assertType)|expect-type\.expectTypeOf)(?:\.|$)/u;

export const EXPECT_SETUP =
    /^(?:vitest|bun:test)\.expect\.(?:extend|addEqualityTesters|addSnapshotSerializer|getState|setState|assertions|hasAssertions)$/u;

export const PLAYWRIGHT_EXPECT = /^@playwright\/test\.(?:test\.)?expect(?:\.|$)/u;

export const NODE_TEST_NAME = /^(?:node:)?test(?:\.|$)/u;

export const GLOBAL_EXPECTS = new Set([
    'expect',
    'expectAsync',
    'expectObservable',
    'expectSubscriptions',
    'expectTypeOf',
]);

export const GLOBAL_EXPECT_IMPORTS = ['bun:test', '@playwright/test'];

export const GLOBAL_EXPECT_DEPENDENCIES = ['jasmine', 'jest', 'cypress', '@playwright/test'];

export const EVIDENCE_IMPORTS = [
    'chai',
    'sinon',
    'supertest',
    'assert',
    'assert/strict',
    'node:assert',
    'node:assert/strict',
    'uvu/assert',
    'vitest',
    'vitest/node',
    'bun:test',
    '@playwright/test',
    'aws-cdk-lib/assertions',
    '@angular/common/http/testing',
];

export const EVIDENCE_DEPENDENCIES = ['cypress', 'jasmine', 'jest', '@playwright/test'];

export const TEST_FRAMEWORK_IMPORTS = [
    '@jest/globals',
    '@playwright/test',
    'chai',
    'cypress',
    'jasmine',
    'jest',
    'mocha',
    'bun:test',
    'node:test',
    'sinon',
    'supertest',
    'uvu',
    'vitest',
];

export const TEST_FRAMEWORK_DEPENDENCIES = [
    '@jest/globals',
    '@playwright/test',
    'chai',
    'cypress',
    'jasmine',
    'jasmine-core',
    'jasmine-node',
    'jest',
    'karma-jasmine',
    'mocha',
    'sinon',
    'supertest',
    'uvu',
    'vitest',
];

export const CHAI_TERMINALS = new Set([
    'Arguments',
    'NaN',
    'arguments',
    'empty',
    'exist',
    'extensible',
    'false',
    'finite',
    'frozen',
    'null',
    'ok',
    'sealed',
    'true',
    'undefined',
]);

export const ASSERTION_TEXT = /\b(?:expect|assert|should)\b/u;

export const CHECKED_TEST_CALLEE = /^(?:it|specify|test)(?:\.(?:only|skip))?$/u;

export const HTTP_TESTING_MODULE = '@angular/common/http/testing';

export const HTTP_EXPECTATIONS = new Set(['expectOne', 'expectNone', 'verify']);

export const DONE_CALLBACKS =
    'CallExpression[arguments.length>0] > Identifier.callee, CallExpression[callee.property.name="catch"] > Identifier.arguments:first-child, CallExpression[callee.property.name=/^(?:then|subscribe)$/] > Identifier.arguments:nth-child(2), CallExpression[callee.property.name="subscribe"] > ObjectExpression > Property[key.name="error"] > Identifier.value';
