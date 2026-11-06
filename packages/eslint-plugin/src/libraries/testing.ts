import { AST_NODE_TYPES, ASTUtils, type TSESLint, type TSESTree } from '@typescript-eslint/utils';

import { FUNCTION_NODES } from '../config/plugin.ts';
import {
    CALL_STEP,
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
import { findFunction } from '../language/functions.ts';
import type { FileContext } from '../types/plugin.ts';
import type { TableCall, TestCall, TestCallee, TestOrigin } from '../types/testing.ts';
import { getRequiredModule, isModuleUsed } from './packages.ts';

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
    return definition === undefined
        ? { name: base.name, module: undefined }
        : (getImportedName(definition) ?? getRequiredName(definition));
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
Get the name at the base of a callee, its module when a test framework exports it, and the member names after it.
A call of `each` without its table call counts as no callee.
*/
export function getCalleeName(callee: TSESTree.Node, source: TSESLint.SourceCode): TestCallee | undefined {
    const { steps, base } = listCalleeSteps(callee);
    const isFactory = steps.some((step, index) => step === 'each' && steps[index - 1] !== CALL_STEP);
    if (isFactory || base.type !== AST_NODE_TYPES.Identifier) return undefined;
    const origin = getOrigin(base, source);
    const modifiers = steps.filter((step) => step !== CALL_STEP).toReversed();
    return origin && { ...origin, base, modifiers };
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

export function listChildNodes(node: TSESTree.Node, source: TSESLint.SourceCode): TSESTree.Node[] {
    const keys = source.visitorKeys[node.type] ?? [];
    const values = keys.flatMap((key): unknown => node[key as keyof TSESTree.Node]);
    return values.filter((value): value is TSESTree.Node => value !== null && typeof value === 'object');
}

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

export function readTestTable(node: TableCall, context: FileContext): TSESTree.Node | undefined {
    const [table] = node.callee.arguments;
    const callback = findFunction(node.arguments[1], context.sourceCode);
    const isTable = isTableTest(getTestCall(node, context.sourceCode), context);
    return isTable && callback !== undefined && table?.type !== AST_NODE_TYPES.SpreadElement ? table : undefined;
}

export function isSameTokens(left: TSESTree.Node, right: TSESTree.Node, source: TSESLint.SourceCode): boolean {
    const leftTokens = source.getTokens(left).map(({ value }) => value);
    const rightTokens = source.getTokens(right).map(({ value }) => value);
    return left.type === right.type && leftTokens.join('\0') === rightTokens.join('\0');
}

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

export function isCypressChain(node: TSESTree.Node): boolean {
    let value = node;
    while (value.type === AST_NODE_TYPES.MemberExpression || value.type === AST_NODE_TYPES.CallExpression)
        value = value.type === AST_NODE_TYPES.MemberExpression ? value.object : value.callee;
    return value.type === AST_NODE_TYPES.Identifier && value.name === 'cy';
}

export function isCallOf(node: TSESTree.Node, name: string): node is TSESTree.CallExpression {
    if (node.type !== AST_NODE_TYPES.CallExpression) return false;
    const { callee } = node;
    return ASTUtils.isIdentifier(callee) && callee.name === name;
}
