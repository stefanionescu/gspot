import { AST_NODE_TYPES, ASTUtils, type TSESLint, type TSESTree } from '@typescript-eslint/utils';

import {
    CALL_STEP,
    MARKED_TEST_MODIFIERS,
    PLAYWRIGHT_LOCATOR,
    PLAYWRIGHT_SUITE_MODES,
    RUNNING_TEST_MODIFIERS,
    TABLE_DEPENDENCIES,
    TABLE_MODULES,
    TABLE_ORIGINS,
    TABLE_TEST_NAMES,
    TEST_FILE_EXTENSIONS,
    TEST_FILE_MARKERS,
    TEST_FOLDERS,
    TEST_FRAMEWORK_MODULES,
    TEST_KINDS,
} from '../config/testing.ts';
import { findEnclosingFunction, findFunction } from '../language/functions.ts';
import { getRequiredModule, listImportedModules } from '../language/modules.ts';
import { isModuleUsed, readPackageFacts } from '../language/packages.ts';
import type { FileContext, MemberCall } from '../types/plugin.ts';
import type {
    CalleeChain,
    FrameworkDependency,
    FrameworkImport,
    TableCall,
    TestCall,
    TestCallee,
    TestOrigin,
} from '../types/testing.ts';

function getImportedOrigin(definition: TSESLint.Scope.Definition): TestOrigin | undefined {
    const { node, parent } = definition;
    const module = parent?.type === AST_NODE_TYPES.ImportDeclaration ? parent.source.value : '';
    if (!TEST_FRAMEWORK_MODULES.has(module)) return undefined;
    if (node.type === AST_NODE_TYPES.ImportDefaultSpecifier) return { name: 'test', module };
    if (node.type !== AST_NODE_TYPES.ImportSpecifier) return undefined;
    const { imported } = node;
    return { name: imported.type === AST_NODE_TYPES.Identifier ? imported.name : imported.value, module };
}

function getRequiredOrigin(definition: TSESLint.Scope.Definition): TestOrigin | undefined {
    const { node, name } = definition;
    if (node.type !== AST_NODE_TYPES.VariableDeclarator || node.init === null) return undefined;
    const module = getRequiredModule(node.init) ?? '';
    if (!TEST_FRAMEWORK_MODULES.has(module)) return undefined;
    const member = node.init.type === AST_NODE_TYPES.MemberExpression ? ASTUtils.getPropertyName(node.init) : 'test';
    const key = name.parent.type === AST_NODE_TYPES.Property ? ASTUtils.getPropertyName(name.parent) : member;
    return key === null ? undefined : { name: key, module };
}

function getOrigin(base: TSESTree.Identifier, source: TSESLint.SourceCode): TestOrigin | undefined {
    const variable = ASTUtils.findVariable(source.getScope(base), base);
    const [definition] = variable?.defs ?? [];
    return definition === undefined
        ? { name: base.name, module: undefined }
        : (getImportedOrigin(definition) ?? getRequiredOrigin(definition));
}

function listCalleeSteps(callee: TSESTree.Node): { steps: string[]; base: TSESTree.Node } {
    const steps: string[] = [];
    let node = callee;
    while (node.type === AST_NODE_TYPES.CallExpression || node.type === AST_NODE_TYPES.MemberExpression) {
        if (node.type === AST_NODE_TYPES.CallExpression) {
            steps.push(CALL_STEP);
            node = node.callee;
        } else {
            steps.push(ASTUtils.getPropertyName(node) ?? '');
            node = node.object;
        }
    }
    return { steps, base: node };
}

function isTableTest(call: TestCall | undefined, context: FileContext): call is TestCall {
    const isRunning = call?.modifiers.slice(0, -1).every((modifier) => RUNNING_TEST_MODIFIERS.has(modifier)) === true;
    const isTable = isRunning && TABLE_TEST_NAMES.has(call.name);
    return isTable && (TABLE_ORIGINS.has(call.module) || isModuleUsed(context, TABLE_MODULES, TABLE_DEPENDENCIES));
}

/**
Get the identifier at the base of a callee and the member names after it, as the code writes them, whatever the
identifier holds. A call of `each` without its table call counts as no callee.
*/
export function getCalleeChain(callee: TSESTree.Node): CalleeChain | undefined {
    const { steps, base } = listCalleeSteps(callee);
    const isFactory = steps.some((step, index) => step === 'each' && steps[index - 1] !== CALL_STEP);
    if (isFactory || base.type !== AST_NODE_TYPES.Identifier) return undefined;
    return { base, modifiers: steps.filter((step) => step !== CALL_STEP).toReversed() };
}

/**
Get the callee chain with the origin of its base: a global, or an export of a test framework and its module. A base
that the file defines in another way counts as no callee.
*/
export function getCalleeName(callee: TSESTree.Node, source: TSESLint.SourceCode): TestCallee | undefined {
    const chain = getCalleeChain(callee);
    const origin = chain && getOrigin(chain.base, source);
    return origin && { ...origin, ...chain };
}

/**
Get a call of a test runner: a test case, a suite, or a hook, with its first function argument. The callee names a
global or an export of a test framework. In `test.describe` and in the `test.it` of node:test, the name after `test`
names the construct.
*/
export function getTestCall(node: TSESTree.CallExpression, source: TSESLint.SourceCode): TestCall | undefined {
    const callee = getCalleeName(node.callee, source);
    if (callee === undefined) return undefined;
    const first = callee.modifiers[0] ?? '';
    const isNested = callee.name === 'test' && TEST_KINDS.has(first);
    const name = isNested ? first : callee.name;
    const kind = TEST_KINDS.get(name);
    if (kind === undefined) return undefined;
    const callback = node.arguments.find(
        (argument): argument is NonNullable<TestCall['callback']> =>
            argument.type === AST_NODE_TYPES.FunctionExpression ||
            argument.type === AST_NODE_TYPES.ArrowFunctionExpression,
    );
    return { ...callee, kind, name, callback, modifiers: callee.modifiers.slice(Number(isNested)) };
}

export function isPlaywrightSuite(node: TSESTree.Node): boolean {
    if (node.type !== AST_NODE_TYPES.MemberExpression) return false;
    const name = ASTUtils.getPropertyName(node);
    return name === 'describe'
        ? node.object.type === AST_NODE_TYPES.Identifier && node.object.name === 'test'
        : PLAYWRIGHT_SUITE_MODES.has(name) && isPlaywrightSuite(node.object);
}

/**
Get the test runner call at a node when each of its modifiers marks the call to run alone or to be skipped.
*/
export function getMarkedTestCall(node: TSESTree.Node, source: TSESLint.SourceCode): TestCall | undefined {
    const call = node.type === AST_NODE_TYPES.CallExpression ? getTestCall(node, source) : undefined;
    return call?.modifiers.every((modifier) => MARKED_TEST_MODIFIERS.has(modifier)) === true ? call : undefined;
}

export function isRunningTestCall(call: TestCall): boolean {
    return call.modifiers.every((modifier) => RUNNING_TEST_MODIFIERS.has(modifier));
}

export function listEnclosingTestCalls(node: TSESTree.Node, source: TSESLint.SourceCode): TestCall[] {
    return source.getAncestors(node).flatMap((ancestor) => getMarkedTestCall(ancestor, source) ?? []);
}

export function getEnclosingTestCall(node: TSESTree.Node, source: TSESLint.SourceCode): TestCall | undefined {
    const parent = findEnclosingFunction(node, source)?.parent;
    return parent?.type === AST_NODE_TYPES.CallExpression ? getTestCall(parent, source) : undefined;
}

export function readTestTable(node: TableCall, context: FileContext): TSESTree.Node | undefined {
    const [table] = node.callee.arguments;
    const callback = findFunction(node.arguments[1], context.sourceCode);
    const isTable = isTableTest(getTestCall(node, context.sourceCode), context);
    return isTable && callback !== undefined && table?.type !== AST_NODE_TYPES.SpreadElement ? table : undefined;
}

export function isTestRelatedPath(path: string): boolean {
    if (path.split(/[\\/]/u).some((folder) => TEST_FOLDERS.has(folder))) return true;
    return TEST_FILE_EXTENSIONS.some((extension) =>
        TEST_FILE_MARKERS.some((marker) => path.endsWith(`.${marker}.${extension}`)),
    );
}

/**
Select the test framework of a file from the first entry of `imports` whose modules it imports. Without one, take the
first entry of `dependencies` that a package.json file up to the root lists. The imports win, because a repository can
list several frameworks.
*/
export function selectFramework<Framework>(
    context: FileContext,
    imports: ReadonlyArray<FrameworkImport<Framework>>,
    dependencies: ReadonlyArray<FrameworkDependency<Framework>>,
): Framework | undefined {
    const imported = listImportedModules(context.sourceCode);
    const direct = imports.find(({ modules }) => modules.some((module) => imported.has(module)));
    if (direct !== undefined) return direct.framework;
    const listed = readPackageFacts(context).dependencies;
    return dependencies.find((entry) => entry.dependencies.some((name) => listed.has(name)))?.framework;
}

/**
Check whether a node calls a Playwright locator query: `locator`, `frameLocator`, or a `getBy` method of a page, a
frame, or a locator.
*/
export function isLocatorQuery(node: TSESTree.Node): node is MemberCall {
    return (
        node.type === AST_NODE_TYPES.CallExpression &&
        node.callee.type === AST_NODE_TYPES.MemberExpression &&
        PLAYWRIGHT_LOCATOR.test(ASTUtils.getPropertyName(node.callee) ?? '')
    );
}

export function isCypressChain(node: TSESTree.Node): boolean {
    let value = node;
    while (value.type === AST_NODE_TYPES.MemberExpression || value.type === AST_NODE_TYPES.CallExpression)
        value = value.type === AST_NODE_TYPES.MemberExpression ? value.object : value.callee;
    return value.type === AST_NODE_TYPES.Identifier && value.name === 'cy';
}
