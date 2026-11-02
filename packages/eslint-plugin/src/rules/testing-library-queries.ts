import { createRule } from '../rule.ts';
import { isCallOf } from '../testing.ts';
import { readModuleName } from '../modules.ts';
import { unwrapExpression } from '../syntax.ts';
import { FUNCTION_NODES } from '../config/rules.ts';
import type { QueryUse, MemberCall, ExpectSubject } from '../types/rules.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    QUERY_METHOD,
    QUERY_ASSERTION,
    ALL_QUERY_METHOD,
    REMOVAL_CALLBACK,
    PRESENCE_MATCHERS,
    TESTING_LIBRARY_MODULES,
} from '../config/testing.ts';

function isLibraryName(node: TSESTree.Node, name: string, source: TSESLint.SourceCode): boolean {
    const qualified = readModuleName(node, source) ?? '';
    return TESTING_LIBRARY_MODULES.some(
        (module) =>
            qualified === `${module}.${name}` || (qualified.startsWith(`${module}/`) && qualified.endsWith(`.${name}`)),
    );
}

function readScreenQuery(node: TSESTree.Node, source: TSESLint.SourceCode): TSESTree.Identifier | undefined {
    const value = unwrapExpression(node);
    const callee = value.type === AST_NODE_TYPES.CallExpression ? value.callee : undefined;
    if (callee?.type !== AST_NODE_TYPES.MemberExpression || !ASTUtils.isIdentifier(callee.property)) return undefined;
    const isQuery = QUERY_METHOD.test(callee.property.name) && isLibraryName(callee.object, 'screen', source);
    return isQuery ? callee.property : undefined;
}

function readQueryTarget(node: TSESTree.Node): TSESTree.Node {
    const value = unwrapExpression(node);
    if (value.type !== AST_NODE_TYPES.MemberExpression || value.object.type !== AST_NODE_TYPES.CallExpression)
        return value;
    const { callee } = value.object;
    const method = callee.type === AST_NODE_TYPES.MemberExpression ? ASTUtils.getPropertyName(callee) : null;
    const isElement = value.computed || ASTUtils.getPropertyName(value) === 'length';
    return isElement && ALL_QUERY_METHOD.test(method ?? '') ? value.object : value;
}

function readExpectSubject(target: TSESTree.Node): ExpectSubject | undefined {
    const negation =
        target.type === AST_NODE_TYPES.MemberExpression && ASTUtils.getPropertyName(target) === 'not'
            ? target
            : undefined;
    const expect = negation?.object ?? target;
    const [value] = isCallOf(expect, 'expect') ? expect.arguments : [];
    return value === undefined ? undefined : { value, isNegated: negation !== undefined };
}

function isInsideWaitFor(node: TSESTree.Node, source: TSESLint.SourceCode): boolean {
    const functions = source.getAncestors(node).filter((ancestor) => FUNCTION_NODES.has(ancestor.type));
    const calls = functions.map(({ parent }) => parent);
    return calls.some(
        (call) => call?.type === AST_NODE_TYPES.CallExpression && isLibraryName(call.callee, 'waitFor', source),
    );
}

function readMismatch(node: MemberCall, source: TSESLint.SourceCode): QueryUse | undefined {
    const subject = readExpectSubject(node.callee.object);
    const method = subject && readScreenQuery(readQueryTarget(subject.value), source);
    const isPresence = PRESENCE_MATCHERS.has(ASTUtils.getPropertyName(node.callee)) !== subject?.isNegated;
    const isMismatch =
        method !== undefined && !method.name.startsWith('find') && isPresence !== method.name.startsWith('get');
    return isMismatch && !isInsideWaitFor(node, source) ? { method, isPresence } : undefined;
}

export const testingLibraryQueries = createRule<[], 'presence' | 'absence' | 'throwingQuery' | 'asyncQuery'>({
    name: 'testing-library-queries',
    meta: {
        defaultOptions: [],
        type: 'problem',
        fixable: 'code',
        docs: {
            level: 'recommended',
            description:
                'Reports a Testing Library `screen` query of the wrong kind: a `queryBy*` query in a presence assertion such as `toBeInTheDocument`, a `getBy*` query in an absence assertion such as `not.toBeInTheDocument` or `toBeNull`, and a `getBy*` or `findBy*` query that `waitForElementToBeRemoved` reads. Assertions inside `waitFor` are not checked. The fix swaps `getBy` and `queryBy`.',
            why: 'A `getBy*` query throws when the element is missing, so an absence assertion never sees a missing element. A `queryBy*` query returns null, so a presence failure loses the error that lists the page.',
            fix: 'Use `getBy*` to assert that an element is present, and `queryBy*` to assert that it is absent or to wait for it to go.',
            example:
                '`expect(screen.getByText("Saved")).not.toBeInTheDocument()` reports `absence`. Write `expect(screen.queryByText("Saved")).not.toBeInTheDocument()`.',
        },
        schema: [],
        messages: {
            presence:
                'A presence assertion should use a `getBy*` query, so a missing element produces Testing Library diagnostics.',
            absence: 'An absence assertion should use a `queryBy*` query, so it can observe a missing element.',
            throwingQuery:
                'Use a `queryBy*` callback, so waitForElementToBeRemoved can report a clear error when the element is already absent.',
            asyncQuery: 'A `findBy*` query returns a promise, not the element that this disappearance wait needs.',
        },
    },
    create(context) {
        const source = context.sourceCode;
        return {
            [QUERY_ASSERTION](node: MemberCall) {
                const mismatch = readMismatch(node, source);
                if (mismatch === undefined) return;
                const { method, isPresence } = mismatch;
                const name = isPresence ? method.name.replace('query', 'get') : method.name.replace('get', 'query');
                context.report({
                    node: method,
                    messageId: isPresence ? 'presence' : 'absence',
                    fix: (fixer) => fixer.replaceText(method, name),
                });
            },
            [REMOVAL_CALLBACK](node: TSESTree.Node) {
                const query = readScreenQuery(node, source);
                const call = source
                    .getAncestors(node)
                    .findLast((ancestor) => ancestor.type === AST_NODE_TYPES.CallExpression);
                if (
                    query === undefined ||
                    call === undefined ||
                    !isLibraryName(call.callee, 'waitForElementToBeRemoved', source)
                )
                    return;
                const isDirect = node.parent?.type === AST_NODE_TYPES.CallExpression;
                if (query.name.startsWith('find')) context.report({ node: query, messageId: 'asyncQuery' });
                else if (!isDirect && query.name.startsWith('get'))
                    context.report({
                        node: query,
                        messageId: 'throwingQuery',
                        fix: (fixer) => fixer.replaceText(query, query.name.replace('get', 'query')),
                    });
            },
        };
    },
});
