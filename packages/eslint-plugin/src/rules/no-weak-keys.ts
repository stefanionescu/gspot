import { createRule } from '../rule.ts';
import { readExpressionValue, readOptionProperties } from '../values.ts';
import { WEAK_CURVES, KEY_PAIR_SELECTOR, MINIMUM_KEY_LENGTHS } from '../config/security.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function readStaticValue(
    source: Readonly<TSESLint.SourceCode>,
    property: TSESTree.Property | null | undefined,
): unknown {
    if (property === null || property === undefined) return undefined;
    const value = ASTUtils.getStaticValue(property.value, source.getScope(property.value));
    return value?.value;
}

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
                const property = readOptionProperties(options, source).get(option);
                const length = readStaticValue(source, property);
                if (property && typeof length === 'number' && length > 0 && length < minimum)
                    context.report({
                        node: property,
                        messageId: 'shortKey',
                        data: { option, minimum: String(minimum), algorithm },
                    });
            }
        };
        const checkCurve = (options: TSESTree.ObjectExpression): void => {
            const curve = readOptionProperties(options, source).get('namedCurve');
            const name = readStaticValue(source, curve);
            if (curve && typeof name === 'string' && WEAK_CURVES.has(name))
                context.report({ node: curve, messageId: 'weakCurve', data: { curve: name } });
        };
        return {
            [KEY_PAIR_SELECTOR](node: TSESTree.CallExpression) {
                const [algorithmArgument, optionsArgument] = node.arguments;
                const options = readExpressionValue(optionsArgument, source);
                if (algorithmArgument === undefined || options?.type !== AST_NODE_TYPES.ObjectExpression) return;
                const algorithm = ASTUtils.getStaticValue(algorithmArgument, source.getScope(node))?.value;
                if (algorithm === 'ec') checkCurve(options);
                else if (algorithm === 'rsa' || algorithm === 'dsa') checkLengths(algorithm, options);
            },
        };
    },
});
