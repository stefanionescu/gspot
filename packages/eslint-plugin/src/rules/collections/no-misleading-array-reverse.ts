import { AST_NODE_TYPES, ASTUtils, type TSESTree } from '@typescript-eslint/utils';

import {
    GETTER_DECLARATION,
    MUTABLE_TARGETS,
    MUTATING_ORDER_METHODS,
    RETURNED_PARENTS,
    STANDALONE_PARENTS,
} from '../../config/collections.ts';
import { getTypeCategory, getTypes } from '../../language/checker.ts';
import { createRule } from '../../rule.ts';
import type { TypeReader } from '../../types/plugin.ts';

function isNestedIn(node: TSESTree.Node, target: AST_NODE_TYPES, transparent: ReadonlySet<string>): boolean {
    let ancestor: TSESTree.Node | undefined = node.parent;
    while (ancestor !== undefined && transparent.has(ancestor.type)) ancestor = ancestor.parent;
    return ancestor?.type === target;
}

function isGetter(node: TSESTree.Node, types: TypeReader): boolean {
    if (node.type !== AST_NODE_TYPES.MemberExpression) return false;
    const declarations = types.checker.getSymbolAtLocation(types.map.get(node.property))?.declarations ?? [];
    const [declaration] = declarations;
    return declarations.length === 1 && declaration !== undefined && GETTER_DECLARATION.test(declaration.getText());
}

function getMutation(node: TSESTree.CallExpression, types: TypeReader) {
    const { callee } = node;
    if (callee.type !== AST_NODE_TYPES.MemberExpression) return undefined;
    const method = ASTUtils.getPropertyName(callee) ?? '';
    const replacement = MUTATING_ORDER_METHODS.get(method);
    const target = callee.object;
    if (replacement === undefined || !MUTABLE_TARGETS.has(target.type) || isGetter(target, types)) return undefined;
    return getTypeCategory(types, types.get(target)) === 'array' ? { method, replacement, target } : undefined;
}

function isKept(node: TSESTree.CallExpression, target: TSESTree.Node): boolean {
    const { parent } = node;
    const isSelfAssignment =
        parent.type === AST_NODE_TYPES.AssignmentExpression &&
        parent.operator === '=' &&
        ASTUtils.isIdentifier(parent.left) &&
        ASTUtils.isIdentifier(target) &&
        parent.left.name === target.name;
    return (
        isSelfAssignment ||
        isNestedIn(node, AST_NODE_TYPES.ExpressionStatement, STANDALONE_PARENTS) ||
        isNestedIn(node, AST_NODE_TYPES.ReturnStatement, RETURNED_PARENTS)
    );
}

export const noMisleadingArrayReverse = createRule<[], 'mutation'>({
    name: 'no-misleading-array-reverse',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            requiresTypeChecking: true,
            description:
                'Reports `reverse` or `sort` on an array variable or property whose result the code uses as a value, such as in an assignment to another name, because the call also changes the array.',
            why: '`reverse` and `sort` change the array in place, so code that reads the result as a new array also changes the original.',
            fix: 'Use `toReversed()` or `toSorted()`, or call the method in its own statement.',
            example:
                '`const newest = posts.reverse();` reports `mutation`. Write `const newest = posts.toReversed();`.',
        },
        schema: [],
        messages: {
            mutation:
                'This {{method}} also changes the original array. Use {{replacement}}, or call it in its own statement.',
        },
    },
    create(context) {
        const types = getTypes(context);
        if (types === undefined) return {};
        return {
            CallExpression(node) {
                const mutation = getMutation(node, types);
                if (mutation === undefined || isKept(node, mutation.target)) return;
                context.report({ node, messageId: 'mutation', data: mutation });
            },
        };
    },
});
