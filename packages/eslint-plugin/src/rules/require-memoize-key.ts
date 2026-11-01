import { createRule } from '../rule.ts';
import { readModuleName } from '../modules.ts';
import { readLocalFunction } from '../functions.ts';
import type { LocalFunction } from '../types/plugin.ts';
import { MEMOIZE_FUNCTIONS } from '../config/frameworks.ts';
import { type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function isMissingKey(keyFunction: TSESTree.CallExpressionArgument | undefined): boolean {
    if (keyFunction === undefined) return true;
    const isVoid = keyFunction.type === AST_NODE_TYPES.UnaryExpression && keyFunction.operator === 'void';
    const isEmpty =
        (keyFunction.type === AST_NODE_TYPES.Identifier && keyFunction.name === 'undefined') ||
        (keyFunction.type === AST_NODE_TYPES.Literal && keyFunction.value === null);
    return isVoid || isEmpty;
}

function readMemoized(node: TSESTree.CallExpression, source: TSESLint.SourceCode): LocalFunction | undefined {
    const [target, keyFunction] = node.arguments;
    const name = (readModuleName(node.callee, source) ?? '').replaceAll('/', '.');
    const isUnkeyed = MEMOIZE_FUNCTIONS.has(name) && isMissingKey(keyFunction);
    return isUnkeyed && target !== undefined ? readLocalFunction(target, source) : undefined;
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
            example:
                '`memoize((price, rate) => price * rate)` reports `keyFunction`. Write `memoize((price, rate) => price * rate, (price, rate) => `${price}:${rate}`)`.',
        },
        schema: [],
        messages: { keyFunction: 'Provide an explicit function to compute the cache key.' },
    },
    create(context) {
        const source = context.sourceCode;
        return {
            CallExpression(node) {
                const parameters = (readMemoized(node, source)?.params ?? []).filter(
                    (parameter) => !(parameter.type === AST_NODE_TYPES.Identifier && parameter.name === 'this'),
                );
                const needsKey =
                    parameters.length > 1 || parameters.some(({ type }) => type === AST_NODE_TYPES.RestElement);
                const callee =
                    node.callee.type === AST_NODE_TYPES.MemberExpression ? node.callee.property : node.callee;
                if (needsKey) context.report({ node: callee, messageId: 'keyFunction' });
            },
        };
    },
});
