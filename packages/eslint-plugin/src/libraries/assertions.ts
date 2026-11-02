import type { FileContext } from '../types/plugin.ts';
import { getModuleName } from '../language/modules.ts';
import { isCallOf, isCypressChain } from './testing.ts';
import { usesModule, listImportedModules } from './packages.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import type {
    Assertion,
    ChaiChain,
    AssertionKind,
    AssertionChecks,
    AssertionStyles,
    AssertionSubject,
    AssertionPredicate,
    AssertionComparison,
} from '../types/assertions.ts';
import {
    EXPECT_SETUP,
    CHAI_TERMINALS,
    GLOBAL_EXPECTS,
    NODE_TEST_NAME,
    TYPE_ASSERTION,
    RUNNER_ASSERTION,
    PLAYWRIGHT_EXPECT,
    SCRIPT_ASSERTIONS,
    GLOBAL_EXPECT_IMPORTS,
    GLOBAL_EXPECT_DEPENDENCIES,
} from '../config/assertions/evidence.ts';
import {
    CHAI_MODULES,
    EXPECT_STYLES,
    CHAI_ASSERTION,
    NODE_ASSERTION,
    ASSERT_FUNCTION,
    CHAI_PREDICATES,
    CYPRESS_MODULES,
    CHAI_COMPARISONS,
    EXPECT_PREDICATES,
    CHAI_ASSERT_CHECKS,
    CYPRESS_ASSERTIONS,
    EXPECT_COMPARISONS,
    NODE_ASSERT_CHECKS,
    NODE_ASSERT_MODULES,
} from '../config/assertions/styles.ts';

const styleCache = new WeakMap<TSESLint.SourceCode, AssertionStyles>();
const expectPredicates = new Map<string | null, AssertionPredicate>(EXPECT_PREDICATES);
const expectComparisons = new Map<string | null, AssertionComparison>(EXPECT_COMPARISONS);
const chaiPredicates = new Map<string | null, AssertionPredicate>(CHAI_PREDICATES);
const chaiComparisons = new Map<string | null | undefined, AssertionComparison>(CHAI_COMPARISONS);
const chaiAssertChecks = new Map<string, AssertionChecks>(
    CHAI_ASSERT_CHECKS.map(([name, checks]) => [name, { style: 'chai-assert', ...checks }]),
);
const nodeAssertChecks = new Map<string, AssertionChecks>(
    NODE_ASSERT_CHECKS.map(([name, checks]) => [name, { style: 'node-assert', ...checks }]),
);

/**
Read which assertion libraries a file can use: the expect style that its imports or package.json select, chai, and
node:assert.

@param context the rule context of the file.
*/
function readAssertionStyles(context: FileContext): AssertionStyles {
    const cached = styleCache.get(context.sourceCode);
    if (cached !== undefined) return cached;
    const imported = listImportedModules(context.sourceCode);
    const expect =
        EXPECT_STYLES.find(({ modules }) => modules.some((module) => imported.has(module))) ??
        EXPECT_STYLES.find(({ modules, dependencies }) => usesModule(context, modules, dependencies));
    const styles = {
        expect: expect?.style,
        chai: usesModule(context, CHAI_MODULES),
        nodeAssert: NODE_ASSERT_MODULES.some((module) => imported.has(module)),
        cypress: usesModule(context, CYPRESS_MODULES),
        globalExpect: usesModule(context, GLOBAL_EXPECT_IMPORTS, GLOBAL_EXPECT_DEPENDENCIES),
    };
    styleCache.set(context.sourceCode, styles);
    return styles;
}

function getExpectSubject(node: TSESTree.Node): AssertionSubject | undefined {
    const negated = node.type === AST_NODE_TYPES.MemberExpression && ASTUtils.getPropertyName(node) === 'not';
    const expect = negated ? node.object : node;
    const [received, ...others] = isCallOf(expect, 'expect') ? expect.arguments : [];
    const isSingle = others.length === 0 && received !== undefined && received.type !== AST_NODE_TYPES.SpreadElement;
    return isSingle ? { received, negated } : undefined;
}

function getExpectAssertion(node: TSESTree.CallExpression, style: AssertionStyles['expect']): Assertion | undefined {
    const callee = node.callee;
    if (style === undefined || callee.type !== AST_NODE_TYPES.MemberExpression) return undefined;
    const matcher = ASTUtils.getPropertyName(callee);
    const subject = getExpectSubject(callee.object);
    const predicate = node.arguments.length === 0 ? expectPredicates.get(matcher) : undefined;
    if (subject === undefined) return undefined;
    if (predicate !== undefined)
        return { ...subject, style, kind: 'predicate', predicate, node, report: subject.received };
    const checks = { style, comparison: expectComparisons.get(matcher), negated: subject.negated };
    return getCheckedCall(node, checks, callee.property, [subject.received, ...node.arguments]);
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
    const predicate = chaiPredicates.get(ASTUtils.getPropertyName(node));
    if (chain === undefined || predicate === undefined) return undefined;
    const negated = chain.names.includes('not');
    return {
        style: 'chai-bdd',
        kind: 'predicate',
        predicate,
        received: chain.received,
        negated,
        node,
        report: chain.received,
    };
}

function getChaiCall(node: TSESTree.CallExpression, styles: AssertionStyles): Assertion | undefined {
    const member = node.callee;
    if (!styles.chai || member.type !== AST_NODE_TYPES.MemberExpression) return undefined;
    const chain = getChaiChain(member.object);
    const comparison = chaiComparisons.get(ASTUtils.getPropertyName(member));
    if (chain === undefined || comparison === undefined) return undefined;
    const negated = chain.names.includes('not');
    const checks = {
        style: 'chai-bdd' as const,
        comparison: chain.names.includes('deep') ? 'deep' : comparison,
        negated,
    };
    return getCheckedCall(node, checks, member.property, [chain.received, ...node.arguments]);
}

function getCypressChecks(chainer: TSESTree.Node | undefined): AssertionChecks | undefined {
    const names =
        chainer?.type === AST_NODE_TYPES.Literal && typeof chainer.value === 'string' ? chainer.value.split('.') : [];
    const comparison = chaiComparisons.get(names.at(-1));
    const negated = names.includes('not');
    if (comparison === undefined) return undefined;
    return { style: 'cypress', comparison: names.includes('deep') ? 'deep' : comparison, negated };
}

function getCypressCall(node: TSESTree.CallExpression, styles: AssertionStyles): Assertion | undefined {
    const { callee } = node;
    const [chainer, ...values] = node.arguments;
    const isMethod =
        callee.type === AST_NODE_TYPES.MemberExpression && CYPRESS_ASSERTIONS.has(ASTUtils.getPropertyName(callee));
    return styles.cypress && isMethod && values.length === 1 && isCypressChain(callee.object)
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

/**
Read an assertion of Jest, Vitest, Bun, Jasmine, Playwright, chai, Cypress, or node:assert that the file can use. It reads a
predicate on one value or a comparison of two values.

@param node the call or member to read.
@param context the rule context of the file.
*/
export function readAssertion(
    node: TSESTree.CallExpression | TSESTree.MemberExpression,
    context: FileContext,
): Assertion | undefined {
    const styles = readAssertionStyles(context);
    const source = context.sourceCode;
    if (node.type === AST_NODE_TYPES.MemberExpression) return styles.chai ? getChaiPredicate(node) : undefined;
    const checks = getAssertChecks(getModuleName(node.callee, source) ?? source.getText(node.callee), styles);
    return (
        getExpectAssertion(node, styles.expect) ??
        getChaiCall(node, styles) ??
        getCypressCall(node, styles) ??
        getCheckedCall(node, checks, node.callee, node.arguments)
    );
}

function getExpectRoot(node: TSESTree.CallExpression): TSESTree.Node | undefined {
    let value: TSESTree.Node = node.callee;
    while (value.type === AST_NODE_TYPES.MemberExpression) value = value.object;
    return value !== node.callee && value.type === AST_NODE_TYPES.CallExpression ? value.callee : undefined;
}

function isGlobalExpect(node: TSESTree.CallExpression, source: TSESLint.SourceCode): boolean {
    const callee = getExpectRoot(node);
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
Classify a call that asserts with a test library the file can use. Chai, sinon, supertest, node:assert, node:test, uvu,
and the aws-cdk assertions also assert outside a test runner, so they return `script`. Vitest, Bun, Cypress, and the
`expect` of Jest, Jasmine, and Playwright return `runner`, and a type-level assertion returns `type`.

@param node the call to read.
@param context the rule context of the file.
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

function getChainEnd(node: TSESTree.MemberExpression): TSESTree.MemberExpression | undefined {
    let top = node;
    while (top.parent.type === AST_NODE_TYPES.MemberExpression && top.parent.object === top && !top.parent.computed)
        top = top.parent;
    return top === node ? undefined : top;
}

/**
Check whether a property chain of chai forms a complete assertion: one that ends in a call or in a property such as
`true` or `exist`.

@param node the node to read.
*/
export function isChaiPropertyAssertion(node: TSESTree.Node): boolean {
    const top =
        node.type === AST_NODE_TYPES.MemberExpression && ASTUtils.getPropertyName(node) === 'should'
            ? getChainEnd(node)
            : undefined;
    const isCall = top?.parent.type === AST_NODE_TYPES.CallExpression && top.parent.callee === top;
    return top !== undefined && (isCall || CHAI_TERMINALS.has(ASTUtils.getPropertyName(top)));
}
