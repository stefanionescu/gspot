import { createRule } from '../../rule.ts';
import type { FunctionNode } from '../../types/plugin.ts';
import { findFunction } from '../../language/functions.ts';
import { TLS_OPTION_ARGUMENTS } from '../../config/networks.ts';
import { ASTUtils, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { listOptionLiterals, getOptionProperties } from '../../language/expressions.ts';

export const unverifiedHostname = createRule<[], 'unverified'>({
    name: 'unverified-hostname',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Finds `https.request`, `request.get`, and `tls.connect` calls that pass a `checkServerIdentity` function with a block body that accepts every server.',
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
        const returns = new Map<TSESTree.Node, TSESTree.ReturnStatement[]>();
        const checks: Array<{ call: TSESTree.CallExpression; checker: FunctionNode }> = [];
        return {
            ReturnStatement(node) {
                const owner = source.getAncestors(node).findLast((ancestor) => ASTUtils.isFunction(ancestor));
                if (owner !== undefined) returns.set(owner, [...(returns.get(owner) ?? []), node]);
            },
            CallExpression(node) {
                for (const options of listOptionLiterals(node, source, TLS_OPTION_ARGUMENTS)) {
                    const identity = getOptionProperties(options, source).get('checkServerIdentity');
                    const checker = identity ? findFunction(identity.value, source) : undefined;
                    if (checker?.body.type === AST_NODE_TYPES.BlockStatement) checks.push({ call: node, checker });
                }
            },
            'Program:exit'() {
                for (const { call, checker } of checks) {
                    const isAccepting = (returns.get(checker) ?? []).every(
                        ({ argument }) =>
                            argument === null ||
                            ASTUtils.getStaticValue(argument, source.getScope(argument))?.value === true,
                    );
                    if (isAccepting) context.report({ node: call.callee, messageId: 'unverified' });
                }
            },
        };
    },
});
