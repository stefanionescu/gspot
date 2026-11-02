import { createRule } from '../../rule.ts';
import type { FunctionNode } from '../../types/plugin.ts';
import { findFunction } from '../../language/functions.ts';
import { TLS_OPTION_ARGUMENTS } from '../../config/networks.ts';
import { listOptionLiterals, getOptionProperties } from '../../language/expressions.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function buildHostnameCheck(
    call: TSESTree.CallExpression,
    options: TSESTree.ObjectExpression,
    source: TSESLint.SourceCode,
): { call: TSESTree.CallExpression; isRejecting: boolean; checker: FunctionNode | undefined } {
    const properties = getOptionProperties(options, source);
    const rejection = properties.get('rejectUnauthorized');
    const identity = properties.get('checkServerIdentity');
    const checker = identity ? findFunction(identity.value, source) : undefined;
    return {
        call,
        isRejecting: !rejection || ASTUtils.getStaticValue(rejection.value, source.getScope(call))?.value !== false,
        checker: checker?.body.type === AST_NODE_TYPES.BlockStatement ? checker : undefined,
    };
}

export const unverifiedHostname = createRule<[], 'unverified'>({
    name: 'unverified-hostname',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Finds `https.request`, `request.get`, and `tls.connect` calls whose options set `rejectUnauthorized` to `false`, or pass a `checkServerIdentity` function with a block body that accepts every server.',
            why: 'A connection that does not check the server name accepts a valid certificate of any other server, so an attacker on the network can read and change its traffic.',
            fix: 'Remove `rejectUnauthorized: false`. Let `checkServerIdentity` return an error for a name that does not match, or remove the option.',
            example:
                'The call `tls.connect(port, host, { checkServerIdentity: () => { return undefined; } })` reports `unverified`. Remove the `checkServerIdentity` option.',
        },
        schema: [],
        messages: { unverified: 'Verify the server hostname of this connection.' },
    },
    create(context) {
        const source = context.sourceCode;
        const returns = new Map<TSESTree.Node, TSESTree.ReturnStatement[]>();
        const checks: Array<{
            call: TSESTree.CallExpression;
            isRejecting: boolean;
            checker: FunctionNode | undefined;
        }> = [];
        return {
            ReturnStatement(node) {
                const owner = source.getAncestors(node).findLast((ancestor) => ASTUtils.isFunction(ancestor));
                if (owner !== undefined) returns.set(owner, [...(returns.get(owner) ?? []), node]);
            },
            CallExpression(node) {
                const literals = listOptionLiterals(node, source, TLS_OPTION_ARGUMENTS);
                for (const options of literals) checks.push(buildHostnameCheck(node, options, source));
            },
            'Program:exit'() {
                for (const { call, isRejecting, checker } of checks) {
                    const isAccepting =
                        checker !== undefined &&
                        (returns.get(checker) ?? []).every(
                            ({ argument }) =>
                                argument === null ||
                                ASTUtils.getStaticValue(argument, source.getScope(argument))?.value === true,
                        );
                    if (!isRejecting || isAccepting) context.report({ node: call.callee, messageId: 'unverified' });
                }
            },
        };
    },
});
