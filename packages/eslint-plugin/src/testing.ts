import { join, dirname } from 'node:path';
import { PLUGIN_PREFIX } from './config/plugin.ts';
import { FUNCTION_NODES } from './config/rules.ts';
import { readLocalFunction } from './functions.ts';
import { existsSync, readFileSync } from 'node:fs';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import type { TestCall, TableCall, TestOrigin, TestCallee, FileContext, PackageFacts } from './types/rules.ts';

import {
    CALL_STEP,
    TEST_KINDS,
    TABLE_ORIGINS,
    TABLE_MODULES,
    TABLE_TEST_NAMES,
    PACKAGE_MANIFEST,
    DEPENDENCY_FIELDS,
    REPOSITORY_MARKER,
    TABLE_DEPENDENCIES,
    RUNNING_TEST_MODIFIERS,
    PLAYWRIGHT_SUITE_MODES,
    TEST_FRAMEWORK_MODULES,
} from './config/testing.ts';

const manifestCache = new WeakMap<TSESLint.SourceCode, PackageFacts>();

const importCache = new WeakMap<TSESLint.SourceCode, ReadonlySet<string>>();

function readManifestDependencies(path: string): string[] {
    const manifest = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
    const fields = DEPENDENCY_FIELDS.map((field) => manifest[field]);
    return fields.flatMap((value) => (value !== null && typeof value === 'object' ? Object.keys(value) : []));
}

function listManifestFolders(context: FileContext): string[] {
    const root = (context.settings[PLUGIN_PREFIX] as { root?: string } | undefined)?.root;
    let folder = dirname(context.filename);
    const folders = [folder];
    while (folder !== root && dirname(folder) !== folder && !existsSync(join(folder, REPOSITORY_MARKER))) {
        folder = dirname(folder);
        folders.push(folder);
    }
    return folders;
}

/**
Read the package.json files from the folder of the file up to the repository root. Count them, and list the package
names they name.

@param context the rule context of the file.
*/
export function readPackageFacts(context: FileContext): PackageFacts {
    const cached = manifestCache.get(context.sourceCode);
    if (cached !== undefined) return cached;
    const manifests = listManifestFolders(context)
        .map((folder) => join(folder, PACKAGE_MANIFEST))
        .filter((path) => existsSync(path));
    const dependencies = new Set(manifests.flatMap((path) => readManifestDependencies(path)));
    const facts = { dependencies, manifests: manifests.length };
    manifestCache.set(context.sourceCode, facts);
    return facts;
}

function readRequiredModule(node: TSESTree.Node): string | undefined {
    let value = node;
    while (value.type === AST_NODE_TYPES.MemberExpression) value = value.object;
    const call = value.type === AST_NODE_TYPES.CallExpression ? value : undefined;
    if (call?.callee.type !== AST_NODE_TYPES.Identifier || call.callee.name !== 'require') return undefined;
    const [module] = call.arguments.map((argument) => ASTUtils.getStringIfConstant(argument));
    return module ?? undefined;
}

/**
List the modules that a file imports or requires.

@param source the file.
*/
export function listImportedModules(source: TSESLint.SourceCode): ReadonlySet<string> {
    const cached = importCache.get(source);
    if (cached !== undefined) return cached;
    const globalScope = source.getScope(source.ast);
    const references = [...globalScope.through, ...(globalScope.set.get('require')?.references ?? [])];
    const modules = new Set([
        ...source.ast.body.flatMap((statement) =>
            statement.type === AST_NODE_TYPES.ImportDeclaration ? [statement.source.value] : [],
        ),
        ...references.flatMap((reference) => readRequiredModule(reference.identifier.parent) ?? []),
    ]);
    importCache.set(source, modules);
    return modules;
}

/**
Check whether the file imports one of the modules, or a package.json above it depends on one of the packages.

@param context the rule context of the file.
@param modules the module names to find in imports.
@param dependencies the package names to find in the manifests.
*/
export function usesModule(
    context: FileContext,
    modules: readonly string[],
    dependencies: readonly string[] = modules,
): boolean {
    const imported = listImportedModules(context.sourceCode);
    if (modules.some((module) => imported.has(module))) return true;
    const listed = readPackageFacts(context).dependencies;
    return dependencies.some((dependency) => listed.has(dependency));
}

function readImportedName(definition: TSESLint.Scope.Definition): TestOrigin | undefined {
    const { node, parent } = definition;
    const module = parent?.type === AST_NODE_TYPES.ImportDeclaration ? parent.source.value : '';
    if (!TEST_FRAMEWORK_MODULES.has(module)) return undefined;
    if (node.type === AST_NODE_TYPES.ImportDefaultSpecifier) return { name: 'test', module };
    if (node.type !== AST_NODE_TYPES.ImportSpecifier) return undefined;
    const { imported } = node;
    return { name: imported.type === AST_NODE_TYPES.Identifier ? imported.name : imported.value, module };
}

function readRequiredName(definition: TSESLint.Scope.Definition): TestOrigin | undefined {
    const { node, name } = definition;
    if (node.type !== AST_NODE_TYPES.VariableDeclarator || node.init === null) return undefined;
    const module = readRequiredModule(node.init) ?? '';
    if (!TEST_FRAMEWORK_MODULES.has(module)) return undefined;
    const member = node.init.type === AST_NODE_TYPES.MemberExpression ? ASTUtils.getPropertyName(node.init) : 'test';
    const key = name.parent.type === AST_NODE_TYPES.Property ? ASTUtils.getPropertyName(name.parent) : member;
    return key === null ? undefined : { name: key, module };
}

function readOrigin(base: TSESTree.Identifier, source: TSESLint.SourceCode): TestOrigin | undefined {
    const variable = ASTUtils.findVariable(source.getScope(base), base);
    const [definition] = variable?.defs ?? [];
    if (definition === undefined) return { name: base.name, module: undefined };
    return readImportedName(definition) ?? readRequiredName(definition);
}

/**
Read the name at the base of a callee, its module when a test framework exports it, and the member names after it.
A call of `each` without its table call counts as no callee.

@param callee the callee to read.
@param source the file and its scopes.
*/
export function readCalleeName(callee: TSESTree.Node, source: TSESLint.SourceCode): TestCallee | undefined {
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
    const origin = readOrigin(node, source);
    const modifiers = steps.filter((step) => step !== CALL_STEP).toReversed();
    return origin && { ...origin, base: node, modifiers };
}

/**
Read a call of a test runner: a test case, a suite, or a hook, with its first function argument. The callee names a
global or an export of a test framework. In `test.describe` and in the `test.it` of node:test, the name after `test`
names the construct.

@param node the call to read.
@param source the file and its scopes.
*/
export function readTestCall(node: TSESTree.CallExpression, source: TSESLint.SourceCode): TestCall | undefined {
    const callee = readCalleeName(node.callee, source);
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
    return PLAYWRIGHT_SUITE_MODES.has(name ?? '') && isPlaywrightSuite(node.object);
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
    return isTable && (TABLE_ORIGINS.has(call.module ?? '') || usesModule(context, TABLE_MODULES, TABLE_DEPENDENCIES));
}

/**
Read the table of a parameterized test or suite of Bun, Jest, or Vitest: `test.each(table)(title, callback)`.

@param node the call that declares the test, which `TABLE_CALL` selects.
@param context the rule context of the file.
*/
export function readTestTable(node: TableCall, context: FileContext): TSESTree.Node | undefined {
    const [table] = node.callee.arguments;
    const callback = readLocalFunction(node.arguments[1] ?? node, context.sourceCode);
    const isTable = isTableTest(readTestCall(node, context.sourceCode), context);
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
