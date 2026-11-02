import { createRule } from '../../rule.ts';
import type { TestCall, SimilarTest } from '../../types/rules.ts';
import { getTestCall, listChildNodes } from '../../libraries/testing.ts';
import { usesModule, listImportedModules } from '../../libraries/packages.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    SIMILAR_TEST_NAMES,
    SIMILAR_TEST_LIMITS,
    GLOBAL_TEST_BLOCKERS,
    SIMILAR_TEST_ORIGINS,
    SIMILAR_TEST_MODULES,
    CONCRETE_TEST_MODIFIERS,
} from '../../config/testing.ts';

function mapLiterals(node: TSESTree.Node, source: TSESLint.SourceCode, literals: Map<number, TSESTree.Literal>): void {
    const isParameter = node.type === AST_NODE_TYPES.Literal && typeof node.value !== 'object';
    if (isParameter) literals.set(node.range[0], node);
    else for (const child of listChildNodes(node, source)) mapLiterals(child, source, literals);
}

function compareBodies(
    base: SimilarTest,
    other: SimilarTest,
    source: TSESLint.SourceCode,
): Set<TSESTree.Node> | undefined {
    const baseTokens = base.body.flatMap((statement) => source.getTokens(statement));
    const otherTokens = other.body.flatMap((statement) => source.getTokens(statement));
    const isSameShape =
        base.body.length === other.body.length &&
        base.body.every((statement, index) => statement.type === other.body[index]?.type) &&
        baseTokens.length === otherTokens.length;
    const parameters = new Set<TSESTree.Node>();
    const isSame = baseTokens.every((token, index) => {
        const otherToken = otherTokens[index] ?? token;
        const left = base.literals.get(token.range[0]);
        const right = other.literals.get(otherToken.range[0]);
        const isParameter =
            left !== undefined && typeof left.value === typeof right?.value && token.value !== otherToken.value;
        if (isParameter) parameters.add(left);
        return isParameter || token.value === otherToken.value;
    });
    return isSameShape && isSame ? parameters : undefined;
}

function listSimilarGroups(tests: SimilarTest[], source: TSESLint.SourceCode): { base: SimilarTest; count: number }[] {
    const grouped = new Set<SimilarTest>();
    const groups: { base: SimilarTest; count: number }[] = [];
    for (const [index, base] of tests.entries()) {
        if (grouped.has(base)) continue;
        const parameters = new Set<TSESTree.Node>();
        const similar = tests.slice(index + 1).filter((other) => {
            const differences = compareBodies(base, other, source);
            const union = new Set([...parameters, ...(differences ?? [])]);
            const isWithin = union.size <= SIMILAR_TEST_LIMITS.parameters && union.size < base.body.length;
            if (differences === undefined || !isWithin) return false;
            for (const parameter of differences) parameters.add(parameter);
            return true;
        });
        if (similar.length + 1 < SIMILAR_TEST_LIMITS.tests || parameters.size === 0) continue;
        for (const each of [base, ...similar]) grouped.add(each);
        groups.push({ base, count: similar.length + 1 });
    }
    return groups;
}

function getComparableTest(
    node: TSESTree.CallExpression,
    call: TestCall,
    source: TSESLint.SourceCode,
): SimilarTest | undefined {
    const [title] = node.arguments;
    const body = call.callback?.body.type === AST_NODE_TYPES.BlockStatement ? call.callback.body.body : [];
    const isConcrete = call.modifiers.every((modifier) => CONCRETE_TEST_MODIFIERS.has(modifier));
    if (!isConcrete || title === undefined || ASTUtils.getStringIfConstant(title) === null) return undefined;
    if (body.length < SIMILAR_TEST_LIMITS.statements) return undefined;
    const literals = new Map<number, TSESTree.Literal>();
    for (const statement of body) mapLiterals(statement, source, literals);
    return { title, body, literals };
}

function getSimilarCall(
    node: TSESTree.CallExpression,
    source: TSESLint.SourceCode,
    origins: ReadonlySet<string | undefined>,
): TestCall | undefined {
    const call = getTestCall(node, source);
    const isTest = call?.kind === 'test' && SIMILAR_TEST_NAMES.has(call.name) && origins.has(call.module);
    return isTest ? call : undefined;
}

export const preferTestTable = createRule<[], 'table'>({
    name: 'prefer-test-table',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'all',
            description:
                'Reports three or more `it` or `test` cases of one block whose bodies match token for token, except for at most three literal values, in Jest, Vitest, Playwright, and Bun files. Each case needs a static title and at least two statements.',
            why: 'Copies of one test differ only in their data, so a reader must compare them line by line, and a fix must change each copy.',
            fix: 'Write one test with `test.each` and a table of the values that differ.',
            example:
                'Three tests that each call `add(1, 2)`, `add(2, 3)`, and `add(3, 4)` and compare the result report `table` on the first title. Write `test.each([[1, 2, 3], [2, 3, 5], [3, 4, 7]])("adds %d and %d", ...)`.',
        },
        schema: [],
        messages: { table: 'Replace these {{count}} tests with a single parameterized one.' },
    },
    create(context) {
        const active = SIMILAR_TEST_MODULES.filter(({ modules, dependencies }) =>
            usesModule(context, modules, dependencies),
        );
        if (active.length === 0) return {};
        const source = context.sourceCode;
        const imported = listImportedModules(source);
        const isGlobal =
            active.some((each) => each.isGlobal) && GLOBAL_TEST_BLOCKERS.every((module) => !imported.has(module));
        const origins = new Set<string | undefined>([...SIMILAR_TEST_ORIGINS, ...(isGlobal ? [undefined] : [])]);
        const frames = new Map<TSESTree.Node | undefined, SimilarTest[]>();
        return {
            CallExpression(node) {
                const call = getSimilarCall(node, source, origins);
                if (call?.callback === undefined) return;
                const frame = source
                    .getAncestors(node)
                    .findLast(
                        (ancestor) =>
                            ancestor.type === AST_NODE_TYPES.BlockStatement || ancestor.type === AST_NODE_TYPES.Program,
                    );
                const test = getComparableTest(node, call, source);
                if (test !== undefined) frames.set(frame, [...(frames.get(frame) ?? []), test]);
            },
            'Program:exit'() {
                const groups = [...frames.values()].flatMap((tests) => listSimilarGroups(tests, source));
                for (const { base, count } of groups)
                    context.report({ node: base.title, messageId: 'table', data: { count: String(count) } });
                frames.clear();
            },
        };
    },
});
