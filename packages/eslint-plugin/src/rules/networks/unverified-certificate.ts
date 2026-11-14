import { createRule } from '../../rule.ts';
import { TLS_OPTION_ARGUMENTS } from '../../config/networks.ts';
import { getOptionValue, listOptionLiterals } from '../../language/expressions.ts';

export const unverifiedCertificate = createRule<[], 'unverified'>({
    name: 'unverified-certificate',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Finds `https.request`, `request.get`, and `tls.connect` calls whose options set `rejectUnauthorized` to `false`.',
            why: 'A connection that accepts any certificate lets an attacker on the network read and change its traffic.',
            fix: 'Remove `rejectUnauthorized: false`. To trust a private certificate authority, pass its certificate in the `ca` option.',
            example:
                'The call `https.request({ host, rejectUnauthorized: false })` reports `unverified`. Use `https.request({ host, ca: authorityCertificate })`.',
        },
        schema: [],
        messages: { unverified: 'Verify the server certificate of this connection. Remove rejectUnauthorized: false.' },
    },
    create(context) {
        const source = context.sourceCode;
        return {
            CallExpression(node) {
                for (const options of listOptionLiterals(node, source, TLS_OPTION_ARGUMENTS)) {
                    if (getOptionValue(options, 'rejectUnauthorized', source)?.value === false)
                        context.report({ node: node.callee, messageId: 'unverified' });
                }
            },
        };
    },
});
