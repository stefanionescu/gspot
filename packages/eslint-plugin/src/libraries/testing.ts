import { FUNCTION_NODES } from '../config/plugin.ts';
import type { FileContext } from '../types/plugin.ts';
import { findFunction } from '../language/functions.ts';
import { usesModule, getRequiredModule } from './packages.ts';
import type { TestCall, TableCall, TestCallee, TestOrigin } from '../types/testing.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    CALL_STEP,
    TEST_KINDS,
    TEST_FOLDERS,
    TABLE_MODULES,
    TABLE_ORIGINS,
    TABLE_TEST_NAMES,
    TEST_FILE_MARKERS,
    TABLE_DEPENDENCIES,
    TEST_FILE_EXTENSIONS,
    PLAYWRIGHT_SUITE_MODES,
    RUNNING_TEST_MODIFIERS,
    TEST_FRAMEWORK_MODULES,
} from '../config/testing.ts';

function getImportedName(definition: TSESLint.Scope.Definition): TestOrigin | undefined {
    const { node, parent } = definition;
    const module = parent?.type === AST_NODE_TYPES.ImportDeclaration ? parent.source.value : '';
    if (!TEST_FRAMEWORK_MODULES.has(module)) return undefined;
    if (node.type === AST_NODE_TYPES.ImportDefaultSpecifier) return { name: 'test', module };
    if (node.type !== AST_NODE_TYPES.ImportSpecifier) return undefined;
    const { imported } = node;
    return { name: imported.type === AST_NODE_TYPES.Identifier ? imported.name : imported.value, module };
}

function getRequiredName(definition: TSESLint.Scope.Definition): TestOrigin | undefined {
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
    if (definition === undefined) return { name: base.name, module: undefined };
    return getImportedName(definition) ?? getRequiredName(definition);
}

/**
Get the name at the base of a callee, its module when a test framework exports it, and the member names after it.
A call of `each` without its table call counts as no callee.

@param callee the callee to read.
@param source the file and its scopes.
*/
export function getCalleeName(callee: TSESTree.Node, source: TSESLint.SourceCode): TestCallee | undefined {
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
    const isFactory = steps.some((step, index) => step === 'each' && steps[index - 1] !== CALL_STEP);
    if (node.type !== AST_NODE_TYPES.Identifier || isFactory) return undefined;
    const origin = getOrigin(node, source);
    const modifiers = steps.filter((step) => step !== CALL_STEP).toReversed();
    return origin && { ...origin, base: node, modifiers };
}

/**
Get a call of a test runner: a test case, a suite, or a hook, with its first function argument. The callee names a
global or an export of a test framework. In `test.describe` and in the `test.it` of node:test, the name after `test`
names the construct.

@param node the call to read.
@param source the file and its scopes.
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

/**
Check whether an expression names a Playwright suite: `test.describe`, with any chain of `parallel` and `serial`.

@param node the callee or the object of a member.
*/
export function isPlaywrightSuite(node: TSESTree.Node): boolean {
    if (node.type !== AST_NODE_TYPES.MemberExpression) return false;
    const name = ASTUtils.getPropertyName(node);
    if (name === 'describe') return node.object.type === AST_NODE_TYPES.Identifier && node.object.name === 'test';
    return PLAYWRIGHT_SUITE_MODES.has(name) && isPlaywrightSuite(node.object);
}

/**
List the child nodes of a node, in source order.

@param node the parent node.
@param source the file, whose visitor keys name the children.
*/
export function listChildNodes(node: TSESTree.Node, source: TSESLint.SourceCode): TSESTree.Node[] {
    const keys = source.visitorKeys[node.type] ?? [];
    const values = keys.flatMap((key): unknown => node[key as keyof TSESTree.Node]);
    return values.filter((value): value is TSESTree.Node => value !== null && typeof value === 'object');
}

/**
List a node and the nodes inside it in source order, without the inside of nested functions.

@param root the node to read.
@param source the file, whose visitor keys name the children.
*/
export function listBodyNodes(root: TSESTree.Node, source: TSESLint.SourceCode): TSESTree.Node[] {
    const nodes: TSESTree.Node[] = [];
    const pending = [root];
    let node = pending.pop();
    while (node !== undefined) {
        nodes.push(node);
        const children = listChildNodes(node, source).filter((child) => !FUNCTION_NODES.has(child.type));
        pending.push(...children.toReversed());
        node = pending.pop();
    }
    return nodes;
}

function isTableTest(call: TestCall | undefined, context: FileContext): call is TestCall {
    const isRunning = call?.modifiers.slice(0, -1).every((modifier) => RUNNING_TEST_MODIFIERS.has(modifier)) === true;
    const isTable = isRunning && TABLE_TEST_NAMES.has(call.name);
    return isTable && (TABLE_ORIGINS.has(call.module) || usesModule(context, TABLE_MODULES, TABLE_DEPENDENCIES));
}

/**
Read the table of a parameterized test or suite of Bun, Jest, or Vitest: `test.each(table)(title, callback)`.

@param node the call that declares the test, which `TABLE_CALL` selects.
@param context the rule context of the file.
*/
export function readTestTable(node: TableCall, context: FileContext): TSESTree.Node | undefined {
    const [table] = node.callee.arguments;
    const callback = findFunction(node.arguments[1], context.sourceCode);
    const isTable = isTableTest(getTestCall(node, context.sourceCode), context);
    return isTable && callback !== undefined && table?.type !== AST_NODE_TYPES.SpreadElement ? table : undefined;
}

/**
Check whether two nodes have one type and the same tokens.

@param left the first node.
@param right the second node.
@param source the file that holds both nodes.
*/
export function isSameTokens(left: TSESTree.Node, right: TSESTree.Node, source: TSESLint.SourceCode): boolean {
    const leftTokens = source.getTokens(left).map(({ value }) => value);
    const rightTokens = source.getTokens(right).map(({ value }) => value);
    return left.type === right.type && leftTokens.join('\0') === rightTokens.join('\0');
}

/**
Check whether a path names a test-related file: a `.test.`, `.spec.`, `.cy.`, `.e2e.`, or `.mock.` file, or a file in
a `__tests__` or `__mocks__` folder.

@param path the path of the file.
@param configured the file extensions from the `testFileExtensions` setting, if any.
*/
export function isTestRelatedPath(path: string, configured: unknown): boolean {
    if (path.split(/[\\/]/u).some((folder) => TEST_FOLDERS.has(folder))) return true;
    const extensions: unknown[] =
        Array.isArray(configured) && configured.length > 0 ? configured : TEST_FILE_EXTENSIONS;
    return extensions.some(
        (extension) =>
            typeof extension === 'string' &&
            TEST_FILE_MARKERS.some((marker) => path.endsWith(`.${marker}.${extension.replace(/^\./u, '')}`)),
    );
}

/**
Check whether an expression chains Cypress commands from `cy`.

@param node the expression to read.
*/
export function isCypressChain(node: TSESTree.Node): boolean {
    let value = node;
    while (value.type !== AST_NODE_TYPES.Identifier) {
        switch (value.type) {
            case AST_NODE_TYPES.MemberExpression: {
                value = value.object;
                break;
            }
            case AST_NODE_TYPES.CallExpression: {
                value = value.callee;
                break;
            }
            default: {
                return false;
            }
        }
    }
    return value.name === 'cy';
}

/**
Check whether a node calls a function by one plain name, such as `expect(value)`.

@param node the node to read.
@param name the name of the function.
*/
export function isCallOf(node: TSESTree.Node, name: string): node is TSESTree.CallExpression {
    if (node.type !== AST_NODE_TYPES.CallExpression) return false;
    const { callee } = node;
    return ASTUtils.isIdentifier(callee) && callee.name === name;
}
