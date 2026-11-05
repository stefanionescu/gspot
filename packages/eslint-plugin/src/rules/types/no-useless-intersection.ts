import { AST_NODE_TYPES, type TSESLint, type TSESTree } from '@typescript-eslint/utils';

import {
    ABSORBING_TYPES,
    EMPTY_TYPE_NAMES,
    INTERFACE_DECLARATION,
    LITERAL_UNION_MEMBERS,
    LITERAL_UNION_SIZE,
} from '../../config/types.ts';
import { getTypes } from '../../language/checker.ts';
import { createRule } from '../../rule.ts';
import type { CheckedType, TypeReader } from '../../types/plugin.ts';

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
        return (
            sibling.type === AST_NODE_TYPES.TSTypeReference &&
            (sibling.typeArguments !== undefined || types.get(sibling).isTypeParameter())
        );
    });
}

function listIntersectionIssues(
    node: TSESTree.TSIntersectionType,
    types: TypeReader,
): Array<TSESLint.ReportDescriptor<'absorbing' | 'empty'>> {
    const absorbing = node.types.find((member) => ABSORBING_TYPES.has(member.type));
    if (absorbing !== undefined)
        return [{ node, messageId: 'absorbing', data: { type: ABSORBING_TYPES.get(absorbing.type) } }];
    return isLiteralUnion(node)
        ? []
        : node.types
              .filter(
                  (member) =>
                      !hasMembers(types.get(member), types) &&
                      !isNormalizing(
                          node.types.filter((sibling) => sibling !== member),
                          types,
                      ),
              )
              .map((member): TSESLint.ReportDescriptor<'empty'> => ({ node: member, messageId: 'empty' }));
}

export const noUselessIntersection = createRule<[], 'empty' | 'absorbing'>({
    name: 'no-useless-intersection',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'recommended',
            requiresTypeChecking: true,
            description:
                'Reports an intersection with `any` or `never`, and an intersection member that has no members, such as `null`, `undefined`, `void`, or `{}`.',
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
            TSIntersectionType: (node) => {
                for (const issue of listIntersectionIssues(node, types)) context.report(issue);
            },
        };
    },
});
