import { createRule } from '../rule.ts';
import { readQualifiedName } from '../modules.ts';
import { readExpressionValue, readOptionProperties } from '../expressions.ts';
import { ASTUtils, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { NO_ALGORITHM, JWT_FUNCTIONS, JWT_OPTIONS_ARGUMENT } from '../config/security.ts';

export const insecureJwtToken = createRule<[], 'unsignedSign' | 'unsignedVerify'>({
    name: 'insecure-jwt-token',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Finds `jsonwebtoken` calls that sign a token with the `none` algorithm, verify a token with `none` among the `algorithms`, or verify a token with a `null` key and no `algorithms` option.',
            why: 'A token without a signature proves nothing, so anyone can forge it.',
            fix: 'Sign with a strong algorithm such as `RS256` or `HS256`, and list only strong algorithms in the `algorithms` option of `verify`.',
            example:
                'The call `jwt.sign(claims, key, { algorithm: "none" })` reports `unsignedSign`. Pass `{ algorithm: "RS256" }`.',
        },
        schema: [],
        messages: {
            unsignedSign: 'Sign this token with a strong algorithm, not none.',
            unsignedVerify: 'Verify this token only with strong algorithms. Set algorithms, and leave out none.',
        },
    },
    create(context) {
        const source = context.sourceCode;
        const checkVerify = (node: TSESTree.CallExpression, options: TSESTree.ObjectExpression): void => {
            const algorithms = readOptionProperties(options, source).get('algorithms');
            const list = algorithms ? readExpressionValue(algorithms.value, source) : undefined;
            const [, key] = node.arguments;
            const isUnsigned =
                list?.type === AST_NODE_TYPES.ArrayExpression
                    ? list.elements.some(
                          (element) =>
                              element !== null &&
                              ASTUtils.getStaticValue(element, source.getScope(element))?.value === NO_ALGORITHM,
                      )
                    : !algorithms && key?.type === AST_NODE_TYPES.Literal && key.value === null;
            if (isUnsigned) context.report({ node: node.callee, messageId: 'unsignedVerify' });
        };
        return {
            CallExpression(node) {
                const name = readQualifiedName(node, source);
                const options = readExpressionValue(node.arguments[JWT_OPTIONS_ARGUMENT], source);
                if (options?.type !== AST_NODE_TYPES.ObjectExpression) return;
                const algorithm =
                    name === JWT_FUNCTIONS.sign ? readOptionProperties(options, source).get('algorithm') : null;
                if (
                    algorithm &&
                    ASTUtils.getStaticValue(algorithm.value, source.getScope(node))?.value === NO_ALGORITHM
                )
                    context.report({ node: node.callee, messageId: 'unsignedSign' });
                if (name === JWT_FUNCTIONS.verify) checkVerify(node, options);
            },
        };
    },
});
