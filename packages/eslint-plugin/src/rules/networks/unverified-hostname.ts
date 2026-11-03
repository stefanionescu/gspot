import { createRule } from '../../rule.ts';
import type { FunctionNode } from '../../types/plugin.ts';
import { findFunction } from '../../language/functions.ts';
import { TLS_OPTION_ARGUMENTS } from '../../config/networks.ts';
import { listOptionLiterals, getOptionProperties } from '../../language/expressions.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

// The falsy values, which Node reads as a hostname that matches.
const ACCEPTED_RESULTS: ReadonlySet<unknown> = new Set([undefined, null, false, 0, '']);

/**
Tell whether a result of checkServerIdentity accepts the server. Node treats a falsy result as a match and any other
result as the error that ends the connection.

@param result the returned expression, or null for a return without a value.
@param source the file and its lexical variables.
*/
function isAcceptingResult(result: TSESTree.Expression | null, source: TSESLint.SourceCode): boolean {
    if (result === null) return true;
    const found = ASTUtils.getStaticValue(result, source.getScope(result));
    return found !== null && ACCEPTED_RESULTS.has(found.value);
}

export const unverifiedHostname = createRule<[], 'unverified'>({
    name: 'unverified-hostname',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Finds `https.request`, `request.get`, and `tls.connect` calls that pass a `checkServerIdentity` function that returns nothing, `undefined`, `null`, or `false` on every path, so it accepts every server.',
            why: 'A connection that does not check the server name accepts a valid certificate of any other server, so an attacker on the network can read and change its traffic.',
            fix: 'Let `checkServerIdentity` return an error for a name that does not match, or remove the option.',
            example:
                'The call `tls.connect(port, host, { checkServerIdentity: () => {} })` reports `unverified`. Remove the `checkServerIdentity` option.',
        },
        schema: [],
        messages: { unverified: 'Verify the server hostname of this connection.' },
    },
    create(context) {
        const source = context.sourceCode;
        const results = new Map<TSESTree.Node, Array<TSESTree.Expression | null>>();
        const checks: Array<{ call: TSESTree.CallExpression; checker: FunctionNode }> = [];
        return {
            ReturnStatement(node) {
                const owner = source.getAncestors(node).findLast((ancestor) => ASTUtils.isFunction(ancestor));
                if (owner !== undefined) results.set(owner, [...(results.get(owner) ?? []), node.argument]);
            },
            'ArrowFunctionExpression[expression=true]'(node: TSESTree.ArrowFunctionExpression) {
                if (node.body.type !== AST_NODE_TYPES.BlockStatement) results.set(node, [node.body]);
            },
            CallExpression(node) {
                for (const options of listOptionLiterals(node, source, TLS_OPTION_ARGUMENTS)) {
                    const identity = getOptionProperties(options, source).get('checkServerIdentity');
                    const checker = identity ? findFunction(identity.value, source) : undefined;
                    if (checker !== undefined) checks.push({ call: node, checker });
                }
            },
            'Program:exit'() {
                for (const { call, checker } of checks)
                    if ((results.get(checker) ?? []).every((result) => isAcceptingResult(result, source)))
                        context.report({ node: call.callee, messageId: 'unverified' });
            },
        };
    },
});
