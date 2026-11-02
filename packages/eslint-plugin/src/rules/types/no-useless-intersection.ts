import { createRule } from '../../rule.ts';
import { getTypes } from '../../language/checker.ts';
import type { TypeReader, CheckedType } from '../../types/plugin.ts';
import { type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    ABSORBING_TYPES,
    EMPTY_TYPE_NAMES,
    LITERAL_UNION_SIZE,
    INTERFACE_DECLARATION,
    LITERAL_UNION_MEMBERS,
} from '../../config/types.ts';

function hasMembers(type: CheckedType, types: TypeReader): boolean {
    if (EMPTY_TYPE_NAMES.has(types.checker.typeToString(type))) return false;
    if (type.getProperties().length > 0 || types.checker.getIndexInfosOfType(type).length > 0) return true;
    const symbol = type.getSymbol();
    const declarations = symbol?.declarations ?? [];
    return (
        symbol === undefined || declarations.some((declaration) => !INTERFACE_DECLARATION.test(declaration.getText()))
    );
}

function isLiteralUnion(node: TSESTree.TSIntersectionType): boolean {
    if (node.types.length !== LITERAL_UNION_SIZE || node.parent.type !== AST_NODE_TYPES.TSUnionType) return false;
    const other = node.types.find(
        (member) => member.type !== AST_NODE_TYPES.TSTypeLiteral || member.members.length > 0,
    );
    return other !== undefined && LITERAL_UNION_MEMBERS.has(other.type);
}

function isNormalizing(siblings: readonly TSESTree.TypeNode[], types: TypeReader): boolean {
    return siblings.some((sibling) => {
        if (sibling.type === AST_NODE_TYPES.TSMappedType) return true;
        if (sibling.type !== AST_NODE_TYPES.TSTypeReference) return false;
        return sibling.typeArguments !== undefined || types.get(sibling).isTypeParameter();
    });
}

export const noUselessIntersection = createRule<[], 'empty' | 'absorbing'>({
    name: 'no-useless-intersection',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'recommended',
            description:
                'Reports an intersection with `any` or `never`, and a member of an intersection that has no members: `null`, `undefined`, `void`, `{}`, or an interface without members that extends nothing. A `string & {}` member of a union, and `{}` beside a mapped type, a generic reference, or a type parameter, pass. It needs type information and reports nothing without it.',
            why: 'Such an intersection is always `any` or `never`, or one of its members adds nothing, so it does not say what the reader expects.',
            fix: 'Remove the member that adds nothing, or write the type that the intersection should have.',
            example: '`type User = Person & {};` reports `empty`. Write `type User = Person;`.',
        },
        schema: [],
        messages: {
            empty: 'This member has no members, so the intersection gains nothing from it. Remove it.',
            absorbing: 'This intersection is always {{type}}. Write {{type}}, or remove that member.',
        },
    },
    create(context) {
        const types = getTypes(context);
        if (types === undefined) return {};
        return {
            TSIntersectionType(node) {
                const absorbing = node.types.find((member) => ABSORBING_TYPES.has(member.type));
                if (absorbing !== undefined) {
                    context.report({
                        node,
                        messageId: 'absorbing',
                        data: { type: ABSORBING_TYPES.get(absorbing.type) },
                    });
                    return;
                }
                for (const member of node.types) {
                    if (hasMembers(types.get(member), types) || isLiteralUnion(node)) continue;
                    if (
                        !isNormalizing(
                            node.types.filter((sibling) => sibling !== member),
                            types,
                        )
                    )
                        context.report({ node: member, messageId: 'empty' });
                }
            },
        };
    },
});
