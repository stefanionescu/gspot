import { readModuleName } from './modules.ts';
import { isCallOf, isCypressChain } from './testing.ts';
import { usesModule, listImportedModules } from './packages.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import type {
    Assertion,
    ChaiChain,
    FileContext,
    AssertionChecks,
    AssertionStyles,
    AssertionSubject,
    AssertionPredicate,
    AssertionComparison,
} from './types/rules.ts';
import {
    CHAI_MODULES,
    EXPECT_STYLES,
    CHAI_ASSERTION,
    NODE_ASSERTION,
    CHAI_PREDICATES,
    ASSERT_FUNCTION,
    CYPRESS_MODULES,
    CHAI_COMPARISONS,
    EXPECT_PREDICATES,
    EXPECT_COMPARISONS,
    NODE_ASSERT_CHECKS,
    CHAI_ASSERT_CHECKS,
    CYPRESS_ASSERTIONS,
    NODE_ASSERT_MODULES,
} from './config/assertions.ts';

const styleCache = new WeakMap<TSESLint.SourceCode, AssertionStyles>();
const expectPredicates = new Map<string, AssertionPredicate>(EXPECT_PREDICATES);
const expectComparisons = new Map<string, AssertionComparison>(EXPECT_COMPARISONS);
const chaiPredicates = new Map<string, AssertionPredicate>(CHAI_PREDICATES);
const chaiComparisons = new Map<string, AssertionComparison>(CHAI_COMPARISONS);
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
    };
    styleCache.set(context.sourceCode, styles);
    return styles;
}

function readExpectSubject(node: TSESTree.Node): AssertionSubject | undefined {
    const negated = node.type === AST_NODE_TYPES.MemberExpression && ASTUtils.getPropertyName(node) === 'not';
    const expect = negated ? node.object : node;
    const [received, ...others] = isCallOf(expect, 'expect') ? expect.arguments : [];
    const isSingle = others.length === 0 && received !== undefined && received.type !== AST_NODE_TYPES.SpreadElement;
    return isSingle ? { received, negated } : undefined;
}

function readExpectAssertion(node: TSESTree.CallExpression, style: AssertionStyles['expect']): Assertion | undefined {
    const callee = node.callee;
    if (style === undefined || callee.type !== AST_NODE_TYPES.MemberExpression) return undefined;
    const matcher = ASTUtils.getPropertyName(callee) ?? '';
    const subject = readExpectSubject(callee.object);
    const predicate = node.arguments.length === 0 ? expectPredicates.get(matcher) : undefined;
    if (subject === undefined) return undefined;
    if (predicate !== undefined)
        return { ...subject, style, kind: 'predicate', predicate, node, report: subject.received };
    const checks = { style, comparison: expectComparisons.get(matcher), negated: subject.negated };
    const values = [subject.received, ...node.arguments];
    return node.arguments.length === 1 ? readCheckedCall(node, checks, callee.property, values) : undefined;
}

function readChaiChain(node: TSESTree.Node): ChaiChain | undefined {
    const names: string[] = [];
    let value = node;
    while (value.type === AST_NODE_TYPES.MemberExpression && !value.computed) {
        const name = ASTUtils.getPropertyName(value) ?? '';
        if (name === 'should') return { received: value.object, names };
        names.unshift(name);
        value = value.object;
    }
    const [received] = isCallOf(value, 'expect') ? value.arguments : [];
    return received === undefined || received.type === AST_NODE_TYPES.SpreadElement ? undefined : { received, names };
}

function readChaiPredicate(node: TSESTree.MemberExpression): Assertion | undefined {
    const chain = readChaiChain(node.object);
    const predicate = chaiPredicates.get(ASTUtils.getPropertyName(node) ?? '');
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

function readChaiCall(node: TSESTree.CallExpression, styles: AssertionStyles): Assertion | undefined {
    const member = node.callee;
    if (!styles.chai || member.type !== AST_NODE_TYPES.MemberExpression) return undefined;
    const chain = readChaiChain(member.object);
    const comparison = chaiComparisons.get(ASTUtils.getPropertyName(member) ?? '');
    if (chain === undefined || comparison === undefined) return undefined;
    const negated = chain.names.includes('not');
    const checks = {
        style: 'chai-bdd' as const,
        comparison: chain.names.includes('deep') ? 'deep' : comparison,
        negated,
    };
    return readCheckedCall(node, checks, member.property, [chain.received, ...node.arguments]);
}

function readCypressChecks(chainer: TSESTree.Node | undefined): AssertionChecks | undefined {
    const names =
        chainer?.type === AST_NODE_TYPES.Literal && typeof chainer.value === 'string' ? chainer.value.split('.') : [];
    const comparison = chaiComparisons.get(names.at(-1) ?? '');
    const negated = names.includes('not');
    if (comparison === undefined) return undefined;
    return { style: 'cypress', comparison: names.includes('deep') ? 'deep' : comparison, negated };
}

function readCypressCall(node: TSESTree.CallExpression, styles: AssertionStyles): Assertion | undefined {
    const callee = node.callee;
    const [chainer, ...values] = node.arguments;
    const method = callee.type === AST_NODE_TYPES.MemberExpression ? ASTUtils.getPropertyName(callee) : null;
    const isAssertion = styles.cypress && CYPRESS_ASSERTIONS.has(method ?? '') && values.length === 1;
    if (!isAssertion || callee.type !== AST_NODE_TYPES.MemberExpression || !isCypressChain(callee.object))
        return undefined;
    return readCheckedCall(node, readCypressChecks(chainer), callee.property, [callee.object, ...values]);
}

function readCheckedCall(
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
    return expected !== undefined && comparison !== undefined
        ? { style, kind: 'comparison', comparison, received, expected, negated, node, report }
        : undefined;
}

function readAssertChecks(name: string, styles: AssertionStyles): AssertionChecks | undefined {
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
export function readAssertion(node: TSESTree.Node, context: FileContext): Assertion | undefined {
    const styles = readAssertionStyles(context);
    const source = context.sourceCode;
    if (node.type === AST_NODE_TYPES.MemberExpression) return styles.chai ? readChaiPredicate(node) : undefined;
    if (node.type !== AST_NODE_TYPES.CallExpression) return undefined;
    const checks = readAssertChecks(readModuleName(node.callee, source) ?? source.getText(node.callee), styles);
    return (
        readExpectAssertion(node, styles.expect) ??
        readChaiCall(node, styles) ??
        readCypressCall(node, styles) ??
        readCheckedCall(node, checks, node.callee, node.arguments)
    );
}
