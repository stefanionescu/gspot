import { ASTUtils, type TSESTree } from '@typescript-eslint/utils';

import { ACCEPTED_RESULTS, TLS_OPTION_ARGUMENTS } from '../../config/networks.ts';
import { getOptionProperties, listOptionLiterals } from '../../language/expressions.ts';
import { findFunction, listReturnedValues } from '../../language/functions.ts';
import { createRule } from '../../rule.ts';
import type { FunctionNode } from '../../types/plugin.ts';

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
        const checks: Array<{ call: TSESTree.CallExpression; checker: FunctionNode }> = [];
        return {
            CallExpression(node) {
                for (const options of listOptionLiterals(node, source, TLS_OPTION_ARGUMENTS)) {
                    const identity = getOptionProperties(options, source).get('checkServerIdentity');
                    const checker = identity ? findFunction(identity.value, source) : undefined;
                    if (checker !== undefined) checks.push({ call: node, checker });
                }
            },
            'Program:exit'() {
                for (const { call, checker } of checks) {
                    // Node treats a falsy result as a match and any other result as the error that ends the connection.
                    const isAccepting = listReturnedValues(checker, source).every((result) => {
                        const found = ASTUtils.getStaticValue(result, source.getScope(result));
                        return found !== null && ACCEPTED_RESULTS.has(found.value);
                    });
                    if (isAccepting) context.report({ node: call.callee, messageId: 'unverified' });
                }
            },
        };
    },
});
