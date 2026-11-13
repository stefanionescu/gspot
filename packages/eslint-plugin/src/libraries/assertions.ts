import { AST_NODE_TYPES, ASTUtils, type TSESLint, type TSESTree } from '@typescript-eslint/utils';

import {
    EXPECT_SETUP,
    GLOBAL_EXPECT_DEPENDENCIES,
    GLOBAL_EXPECT_IMPORTS,
    GLOBAL_EXPECTS,
    NODE_TEST_NAME,
    PLAYWRIGHT_EXPECT,
    RUNNER_ASSERTION,
    SCRIPT_ASSERTIONS,
    TYPE_ASSERTION,
} from '../config/assertions/evidence.ts';
import {
    ASSERT_FUNCTION,
    CHAI_ASSERT_CHECKS,
    CHAI_ASSERTION,
    CHAI_COMPARISONS,
    CHAI_MODULES,
    CHAI_PREDICATES,
    CYPRESS_ASSERTIONS,
    CYPRESS_MODULES,
    EXPECT_COMPARISONS,
    EXPECT_PREDICATES,
    EXPECT_STYLES,
    NODE_ASSERT_CHECKS,
    NODE_ASSERT_MODULES,
    NODE_ASSERTION,
} from '../config/assertions/styles.ts';
import { getModuleName, listImportedModules } from '../language/modules.ts';
import { isModuleUsed } from '../language/packages.ts';
import { getMemberRoot, isCallOf } from '../language/syntax.ts';
import type {
    Assertion,
    AssertionChecks,
    AssertionKind,
    AssertionStyles,
    ChaiChain,
    ExpectCall,
} from '../types/assertions.ts';
import type { FileContext } from '../types/plugin.ts';
import { isCypressChain } from './testing.ts';

const styleCache = new WeakMap<TSESLint.SourceCode, AssertionStyles>();
const chaiAssertChecks = new Map<string, AssertionChecks>(
    CHAI_ASSERT_CHECKS.map(([name, checks]) => [name, { style: 'chai-assert', ...checks }]),
);
const nodeAssertChecks = new Map<string, AssertionChecks>(
    NODE_ASSERT_CHECKS.map(([name, checks]) => [name, { style: 'node-assert', ...checks }]),
);

function readAssertionStyles(context: FileContext): AssertionStyles {
    const cached = styleCache.get(context.sourceCode);
    if (cached !== undefined) return cached;
    const imported = listImportedModules(context.sourceCode);
    const expect =
        EXPECT_STYLES.find(({ modules }) => modules.some((module) => imported.has(module))) ??
        EXPECT_STYLES.find(({ modules, dependencies }) => isModuleUsed(context, modules, dependencies));
    const styles = {
        expect: expect?.style,
        chai: isModuleUsed(context, CHAI_MODULES),
        nodeAssert: NODE_ASSERT_MODULES.some((module) => imported.has(module)),
        cypress: isModuleUsed(context, CYPRESS_MODULES),
        globalExpect: isModuleUsed(context, GLOBAL_EXPECT_IMPORTS, GLOBAL_EXPECT_DEPENDENCIES),
    };
    styleCache.set(context.sourceCode, styles);
    return styles;
}

function getExpectAssertion(node: TSESTree.CallExpression, style: AssertionStyles['expect']): Assertion | undefined {
    const callee = node.callee;
    if (style === undefined || callee.type !== AST_NODE_TYPES.MemberExpression) return undefined;
    const expect = getExpectCall(callee.object);
    if (expect?.call.arguments.length !== 1) return undefined;
    const received = expect.call.arguments.find((argument) => argument.type !== AST_NODE_TYPES.SpreadElement);
    if (received === undefined) return undefined;
    const matcher = ASTUtils.getPropertyName(callee);
    const predicate = node.arguments.length === 0 ? EXPECT_PREDICATES.get(matcher) : undefined;
    const { negated } = expect;
    if (predicate !== undefined)
        return { received, negated, style, kind: 'predicate', predicate, node, report: received };
    const checks = { style, comparison: EXPECT_COMPARISONS.get(matcher), negated };
    return getCheckedCall(node, checks, callee.property, [received, ...node.arguments]);
}

function getChaiChain(node: TSESTree.Node): ChaiChain | undefined {
    const names: Array<string | null> = [];
    let value = node;
    while (value.type === AST_NODE_TYPES.MemberExpression && !value.computed) {
        const name = ASTUtils.getPropertyName(value);
        if (name === 'should') return { received: value.object, names };
        names.unshift(name);
        value = value.object;
    }
    const [received] = isCallOf(value, 'expect') ? value.arguments : [];
    return received === undefined || received.type === AST_NODE_TYPES.SpreadElement ? undefined : { received, names };
}

function getChaiPredicate(node: TSESTree.MemberExpression): Assertion | undefined {
    const chain = getChaiChain(node.object);
    const predicate = CHAI_PREDICATES.get(ASTUtils.getPropertyName(node));
    if (chain === undefined || predicate === undefined) return undefined;
    const isNegated = chain.names.includes('not');
    return {
        style: 'chai-bdd',
        kind: 'predicate',
        predicate,
        received: chain.received,
        negated: isNegated,
        node,
        report: chain.received,
    };
}

function getChaiCall(node: TSESTree.CallExpression, styles: AssertionStyles): Assertion | undefined {
    const member = node.callee;
    if (!styles.chai || member.type !== AST_NODE_TYPES.MemberExpression) return undefined;
    const chain = getChaiChain(member.object);
    const comparison = CHAI_COMPARISONS.get(ASTUtils.getPropertyName(member));
    if (chain === undefined || comparison === undefined) return undefined;
    const checks = {
        style: 'chai-bdd' as const,
        comparison: chain.names.includes('deep') ? 'deep' : comparison,
        negated: chain.names.includes('not'),
    };
    return getCheckedCall(node, checks, member.property, [chain.received, ...node.arguments]);
}

function getCypressChecks(chainer: TSESTree.Node | undefined): AssertionChecks | undefined {
    const names =
        chainer?.type === AST_NODE_TYPES.Literal && typeof chainer.value === 'string' ? chainer.value.split('.') : [];
    const comparison = CHAI_COMPARISONS.get(names.at(-1));
    if (comparison === undefined) return undefined;
    return {
        style: 'cypress',
        comparison: names.includes('deep') ? 'deep' : comparison,
        negated: names.includes('not'),
    };
}

function getCypressCall(node: TSESTree.CallExpression, styles: AssertionStyles): Assertion | undefined {
    const { callee } = node;
    const [chainer, ...values] = node.arguments;
    const isMethod =
        callee.type === AST_NODE_TYPES.MemberExpression && CYPRESS_ASSERTIONS.has(ASTUtils.getPropertyName(callee));
    return isMethod && styles.cypress && values.length === 1 && isCypressChain(callee.object)
        ? getCheckedCall(node, getCypressChecks(chainer), callee.property, [callee.object, ...values])
        : undefined;
}

function getCheckedCall(
    node: TSESTree.CallExpression,
    checks: AssertionChecks | undefined,
    report: TSESTree.Node,
    values: readonly TSESTree.CallExpressionArgument[],
): Assertion | undefined {
    const [received, expected] = values.filter(
        (value): value is TSESTree.Expression => value.type !== AST_NODE_TYPES.SpreadElement,
    );
    if (received === undefined || checks === undefined) return undefined;
    const { style, predicate, comparison, negated } = checks;
    if (predicate !== undefined)
        return { style, kind: 'predicate', predicate, received, negated, node, report: received };
    return expected === undefined || comparison === undefined
        ? undefined
        : { style, kind: 'comparison', comparison, received, expected, negated, node, report };
}

function getAssertChecks(name: string, styles: AssertionStyles): AssertionChecks | undefined {
    const method = ASSERT_FUNCTION.test(name) ? 'assert' : name.slice(name.lastIndexOf('.') + 1);
    const chai = styles.chai && CHAI_ASSERTION.test(name) ? chaiAssertChecks.get(method) : undefined;
    const nodeAssert = styles.nodeAssert && NODE_ASSERTION.test(name) ? nodeAssertChecks.get(method) : undefined;
    return chai ?? nodeAssert;
}

function isGlobalExpect(node: TSESTree.CallExpression, source: TSESLint.SourceCode): boolean {
    const root = getMemberRoot(node.callee);
    const callee = root !== node.callee && root.type === AST_NODE_TYPES.CallExpression ? root.callee : undefined;
    const isNamed = callee?.type === AST_NODE_TYPES.Identifier && GLOBAL_EXPECTS.has(callee.name);
    return isNamed || (callee !== undefined && PLAYWRIGHT_EXPECT.test(getModuleName(callee, source) ?? ''));
}

function getAssertReceiver(callee: TSESTree.Node): TSESTree.Identifier | undefined {
    const member = callee.type === AST_NODE_TYPES.MemberExpression ? callee.object : undefined;
    const isAssert = member?.type === AST_NODE_TYPES.MemberExpression && ASTUtils.getPropertyName(member) === 'assert';
    return isAssert && member.object.type === AST_NODE_TYPES.Identifier ? member.object : undefined;
}

function getParameterOwner(node: TSESTree.Identifier, source: TSESLint.SourceCode): TSESTree.Node | undefined {
    const definition = ASTUtils.findVariable(source.getScope(node), node)?.defs.at(0);
    const owner = definition?.node;
    const isFirst =
        owner !== undefined && ASTUtils.isFunction(owner) && owner.params[0]?.range[0] === definition?.name.range[0];
    return isFirst ? owner : undefined;
}

function isNodeTestAssertion(node: TSESTree.CallExpression, source: TSESLint.SourceCode): boolean {
    const receiver = getAssertReceiver(node.callee);
    const test = receiver === undefined ? undefined : getParameterOwner(receiver, source)?.parent;
    return (
        test?.type === AST_NODE_TYPES.CallExpression && NODE_TEST_NAME.test(getModuleName(test.callee, source) ?? '')
    );
}

function isRunnerAssertion(
    node: TSESTree.CallExpression,
    name: string,
    styles: AssertionStyles,
    source: TSESLint.SourceCode,
): boolean {
    const { callee } = node;
    const isRunner = RUNNER_ASSERTION.test(name) && !EXPECT_SETUP.test(name);
    const isCypress =
        styles.cypress &&
        callee.type === AST_NODE_TYPES.MemberExpression &&
        CYPRESS_ASSERTIONS.has(ASTUtils.getPropertyName(callee)) &&
        isCypressChain(callee.object);
    return isRunner || isCypress || (styles.globalExpect && isGlobalExpect(node, source));
}

/**
Get the `expect(...)` call at the start of a matcher chain, and whether `.not` follows it.
*/
export function getExpectCall(node: TSESTree.Node): ExpectCall | undefined {
    const isNegated = node.type === AST_NODE_TYPES.MemberExpression && ASTUtils.getPropertyName(node) === 'not';
    const call = isNegated ? node.object : node;
    return isCallOf(call, 'expect') ? { call, negated: isNegated } : undefined;
}

export function readAssertion(
    node: TSESTree.CallExpression | TSESTree.MemberExpression,
    context: FileContext,
): Assertion | undefined {
    const styles = readAssertionStyles(context);
    if (node.type === AST_NODE_TYPES.MemberExpression) return styles.chai ? getChaiPredicate(node) : undefined;
    const source = context.sourceCode;
    const checks = getAssertChecks(getModuleName(node.callee, source) ?? source.getText(node.callee), styles);
    return (
        getExpectAssertion(node, styles.expect) ??
        getChaiCall(node, styles) ??
        getCypressCall(node, styles) ??
        getCheckedCall(node, checks, node.callee, node.arguments)
    );
}

/**
Classify a call that asserts with a test library the file can use. Chai, sinon, supertest, node:assert, node:test, uvu,
and the aws-cdk assertions also assert outside a test runner, so they return `script`. Vitest, Bun, Cypress, and the
`expect` of Jest, Jasmine, and Playwright return `runner`, and a type-level assertion returns `type`.
*/
export function readAssertionKind(node: TSESTree.CallExpression, context: FileContext): AssertionKind | undefined {
    const source = context.sourceCode;
    const styles = readAssertionStyles(context);
    const name = getModuleName(node.callee, source) ?? '';
    const isScript =
        SCRIPT_ASSERTIONS.some((pattern) => pattern.test(name)) ||
        (styles.nodeAssert && NODE_ASSERTION.test(name)) ||
        isNodeTestAssertion(node, source);
    if (TYPE_ASSERTION.test(name)) return 'type';
    if (isScript) return 'script';
    return isRunnerAssertion(node, name, styles, source) ? 'runner' : undefined;
}
