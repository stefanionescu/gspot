import { AST_NODE_TYPES, ASTUtils, type TSESLint, type TSESTree } from '@typescript-eslint/utils';

import { JWT_FUNCTIONS, JWT_OPTIONS_ARGUMENT, NO_ALGORITHM } from '../../config/security.ts';
import { getExpressionValue, getOptionProperties, getOptionValue } from '../../language/expressions.ts';
import { getQualifiedName } from '../../language/modules.ts';
import { createRule } from '../../rule.ts';

function isUnsignedVerify(
    node: TSESTree.CallExpression,
    options: TSESTree.ObjectExpression,
    source: TSESLint.SourceCode,
): boolean {
    const algorithms = getOptionProperties(options, source).get('algorithms');
    const list = algorithms ? getExpressionValue(algorithms.value, source) : undefined;
    const [, key] = node.arguments;
    return list?.type === AST_NODE_TYPES.ArrayExpression
        ? list.elements.some(
              (element) =>
                  element !== null &&
                  ASTUtils.getStaticValue(element, source.getScope(element))?.value === NO_ALGORITHM,
          )
        : !algorithms && key?.type === AST_NODE_TYPES.Literal && key.value === null;
}

function findUnsignedUse(
    node: TSESTree.CallExpression,
    options: TSESTree.ObjectExpression,
    source: TSESLint.SourceCode,
): 'unsignedSign' | 'unsignedVerify' | undefined {
    const name = getQualifiedName(node, source);
    if (name === JWT_FUNCTIONS.verify) return isUnsignedVerify(node, options, source) ? 'unsignedVerify' : undefined;
    const algorithm = name === JWT_FUNCTIONS.sign ? getOptionValue(options, 'algorithm', source) : undefined;
    return algorithm?.value === NO_ALGORITHM ? 'unsignedSign' : undefined;
}

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
        return {
            CallExpression(node) {
                const options = getExpressionValue(node.arguments[JWT_OPTIONS_ARGUMENT], source);
                const messageId =
                    options?.type === AST_NODE_TYPES.ObjectExpression
                        ? findUnsignedUse(node, options, source)
                        : undefined;
                if (messageId !== undefined) context.report({ node: node.callee, messageId });
            },
        };
    },
});
