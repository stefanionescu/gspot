import { createRule } from '../../rule.ts';
import type { TypeReader } from '../../types/plugin.ts';
import { getTypes, getTypeCategory } from '../../language/checker.ts';
import { ASTUtils, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    MUTABLE_TARGETS,
    RETURNED_PARENTS,
    GETTER_DECLARATION,
    STANDALONE_PARENTS,
    MUTATING_ORDER_METHODS,
} from '../../config/collections.ts';

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
            description:
                'Reports `reverse` or `sort` on an array variable or property when the result is used as a value, such as in an assignment to another name or an argument. A call that stands alone as a statement, that is returned, or that assigns the array to itself passes. It needs type information and reports nothing without it.',
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
