import { createRule } from '../../rule.ts';
import { getModuleName } from '../../language/modules.ts';
import type { LocalFunction } from '../../types/plugin.ts';
import { MEMOIZE_FUNCTIONS } from '../../config/libraries.ts';
import { getLocalFunction } from '../../language/functions.ts';
import { type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function isMissingKey(keyFunction: TSESTree.CallExpressionArgument | undefined): boolean {
    if (keyFunction === undefined) return true;
    const isVoid = keyFunction.type === AST_NODE_TYPES.UnaryExpression && keyFunction.operator === 'void';
    const isEmpty =
        (keyFunction.type === AST_NODE_TYPES.Identifier && keyFunction.name === 'undefined') ||
        (keyFunction.type === AST_NODE_TYPES.Literal && keyFunction.value === null);
    return isVoid || isEmpty;
}

function getMemoizedFunction(node: TSESTree.CallExpression, source: TSESLint.SourceCode): LocalFunction | undefined {
    const [target, keyFunction] = node.arguments;
    const name = (getModuleName(node.callee, source) ?? '').replaceAll('/', '.');
    const isUnkeyed = MEMOIZE_FUNCTIONS.has(name) && isMissingKey(keyFunction);
    return isUnkeyed && target !== undefined ? getLocalFunction(target, source) : undefined;
}

export const requireMemoizeKey = createRule<[], 'keyFunction'>({
    name: 'require-memoize-key',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Reports a `memoize` call of lodash, lodash-es, or underscore without a key function, when the memoized function takes two or more parameters or a rest parameter.',
            why: 'Without a key function, memoize caches by the first argument alone, so calls that differ only in a later argument return the first cached result.',
            fix: 'Pass a second argument that builds the cache key from every argument that changes the result.',
            example: `\`memoize((price, rate) => price * rate)\` reports \`keyFunction\`. Write \`\`memoize((price, rate) => price * rate, (price, rate) => \`\${price}:\${rate}\`)\`\`.`,
        },
        schema: [],
        messages: { keyFunction: 'Provide an explicit function to compute the cache key.' },
    },
    create(context) {
        const source = context.sourceCode;
        return {
            CallExpression(node) {
                const parameters = (getMemoizedFunction(node, source)?.params ?? []).filter(
                    (parameter) => !(parameter.type === AST_NODE_TYPES.Identifier && parameter.name === 'this'),
                );
                const isKeyRequired =
                    parameters.length > 1 || parameters.some(({ type }) => type === AST_NODE_TYPES.RestElement);
                const callee =
                    node.callee.type === AST_NODE_TYPES.MemberExpression ? node.callee.property : node.callee;
                if (isKeyRequired) context.report({ node: callee, messageId: 'keyFunction' });
            },
        };
    },
});
