import { AST_NODE_TYPES, ASTUtils, type TSESLint, type TSESTree } from '@typescript-eslint/utils';

import { FUNCTION_NODES } from '../../config/plugin.ts';
import {
    ALL_QUERY_METHOD,
    PRESENCE_MATCHERS,
    QUERY_ASSERTION,
    QUERY_METHOD,
    REMOVAL_CALLBACK,
    TESTING_LIBRARY_MODULES,
} from '../../config/testing.ts';
import { getModuleName } from '../../language/modules.ts';
import { unwrapExpression } from '../../language/syntax.ts';
import { getExpectCall } from '../../libraries/assertions.ts';
import { createRule } from '../../rule.ts';
import type { MemberCall } from '../../types/plugin.ts';
import type { QueryUse } from '../../types/testing.ts';

function isLibraryName(node: TSESTree.Node, name: string, source: TSESLint.SourceCode): boolean {
    const qualified = getModuleName(node, source) ?? '';
    return TESTING_LIBRARY_MODULES.some(
        (module) =>
            qualified === `${module}.${name}` || (qualified.startsWith(`${module}/`) && qualified.endsWith(`.${name}`)),
    );
}

function getScreenQuery(node: TSESTree.Node, source: TSESLint.SourceCode): TSESTree.Identifier | undefined {
    const value = unwrapExpression(node);
    const callee = value.type === AST_NODE_TYPES.CallExpression ? value.callee : undefined;
    if (callee?.type !== AST_NODE_TYPES.MemberExpression || !ASTUtils.isIdentifier(callee.property)) return undefined;
    const isQuery = QUERY_METHOD.test(callee.property.name) && isLibraryName(callee.object, 'screen', source);
    return isQuery ? callee.property : undefined;
}

function getQueryTarget(node: TSESTree.Node): TSESTree.Node {
    const value = unwrapExpression(node);
    if (value.type !== AST_NODE_TYPES.MemberExpression || value.object.type !== AST_NODE_TYPES.CallExpression)
        return value;
    const { callee } = value.object;
    const method = callee.type === AST_NODE_TYPES.MemberExpression ? ASTUtils.getPropertyName(callee) : null;
    const isElement = value.computed || ASTUtils.getPropertyName(value) === 'length';
    return isElement && ALL_QUERY_METHOD.test(method ?? '') ? value.object : value;
}

function isInsideWaitFor(node: TSESTree.Node, source: TSESLint.SourceCode): boolean {
    const functions = source.getAncestors(node).filter((ancestor) => FUNCTION_NODES.has(ancestor.type));
    const calls = functions.map(({ parent }) => parent);
    return calls.some(
        (call) => call?.type === AST_NODE_TYPES.CallExpression && isLibraryName(call.callee, 'waitFor', source),
    );
}

function getQueryMismatch(node: MemberCall, source: TSESLint.SourceCode): QueryUse | undefined {
    const expect = getExpectCall(node.callee.object);
    if (expect === undefined) return undefined;
    const [value] = expect.call.arguments;
    const method = value && getScreenQuery(getQueryTarget(value), source);
    const isPresence = PRESENCE_MATCHERS.has(ASTUtils.getPropertyName(node.callee)) !== expect.negated;
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
                'Reports a Testing Library `screen` query of the wrong kind: `queryBy*` in a presence assertion, `getBy*` in an absence assertion, and `getBy*` or `findBy*` that `waitForElementToBeRemoved` reads.',
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
                const mismatch = getQueryMismatch(node, source);
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
                const query = getScreenQuery(node, source);
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
