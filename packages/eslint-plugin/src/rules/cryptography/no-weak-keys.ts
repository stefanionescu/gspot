import { AST_NODE_TYPES, ASTUtils, type TSESTree } from '@typescript-eslint/utils';

import { KEY_PAIR_SELECTOR, MINIMUM_KEY_LENGTHS, WEAK_CURVES } from '../../config/cryptography.ts';
import { getExpressionValue, getOptionValue } from '../../language/expressions.ts';
import { createRule } from '../../rule.ts';

export const noWeakKeys = createRule<[], 'shortKey' | 'weakCurve'>({
    name: 'no-weak-keys',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Finds `generateKeyPair` and `generateKeyPairSync` calls that make an RSA or DSA key with a modulus shorter than 2048 bits or a divisor shorter than 224 bits, or an elliptic curve key on a weak curve.',
            why: 'Attackers can break short keys and weak curves, so the signatures and the encryption that use them protect nothing.',
            fix: 'Use a modulus of at least 2048 bits, a divisor of at least 224 bits, and a curve such as `prime256v1` or `secp384r1`.',
            example:
                'The call `crypto.generateKeyPairSync("rsa", { modulusLength: 1024 })` reports `shortKey`. Pass `{ modulusLength: 2048 }`.',
        },
        schema: [],
        messages: {
            shortKey: 'Use a {{option}} of at least {{minimum}} bits for {{algorithm}} keys.',
            weakCurve: 'The curve {{curve}} is weak. Use a stronger curve, such as prime256v1.',
        },
    },
    create(context) {
        const source = context.sourceCode;
        const checkLengths = (algorithm: string, options: TSESTree.ObjectExpression): void => {
            for (const [option, minimum] of Object.entries(MINIMUM_KEY_LENGTHS)) {
                const found = getOptionValue(options, option, source);
                const length = found?.value;
                if (found && typeof length === 'number' && length > 0 && length < minimum)
                    context.report({
                        node: found.property,
                        messageId: 'shortKey',
                        data: { option, minimum: String(minimum), algorithm },
                    });
            }
        };
        const checkCurve = (options: TSESTree.ObjectExpression): void => {
            const curve = getOptionValue(options, 'namedCurve', source);
            const name = curve?.value;
            if (curve && typeof name === 'string' && WEAK_CURVES.has(name))
                context.report({ node: curve.property, messageId: 'weakCurve', data: { curve: name } });
        };
        return {
            [KEY_PAIR_SELECTOR](node: TSESTree.CallExpression) {
                const [algorithmArgument, optionsArgument] = node.arguments;
                const options = getExpressionValue(optionsArgument, source);
                if (algorithmArgument === undefined || options?.type !== AST_NODE_TYPES.ObjectExpression) return;
                const algorithm = ASTUtils.getStaticValue(algorithmArgument, source.getScope(node))?.value;
                if (algorithm === 'ec') checkCurve(options);
                else if (algorithm === 'rsa' || algorithm === 'dsa') checkLengths(algorithm, options);
            },
        };
    },
});
