import { createRule } from '../../rule.ts';
import { type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { ALIAS_USE_LIMIT, ALIAS_MEMBER_LIMIT, NULLISH_TYPE_KEYWORDS } from '../../config/types.ts';

function findRepeatedType(
    nodes: ReadonlyArray<TSESTree.TSUnionType | TSESTree.TSIntersectionType>,
): TSESLint.ReportDescriptor<'alias'> | undefined {
    const [first, ...rest] = nodes;
    if (first === undefined || rest.length < ALIAS_USE_LIMIT) return undefined;
    const kind = first.type === AST_NODE_TYPES.TSUnionType ? 'union' : 'intersection';
    return { node: first, messageId: 'alias', data: { kind, count: rest.length + 1 } };
}

export const preferTypeAlias = createRule<[], 'alias'>({
    name: 'prefer-type-alias',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'all',
            description:
                'Reports a union or intersection of three or more members that a file writes out three or more times, in any member order, outside type alias declarations. A union of one type with `null` or `undefined` passes.',
            why: 'A long composite type repeated in place hides that the places share one concept, and each copy must change together.',
            fix: 'Declare a type alias for the composite type and use its name in each place.',
            example:
                'Three parameters typed `"small" | "medium" | "large"` report `alias` at the first. Declare `type Size = "small" | "medium" | "large";`.',
        },
        schema: [],
        messages: { alias: 'This {{kind}} type appears {{count}} times. Declare a type alias for it.' },
    },
    create(context) {
        const uses = new Map<string, Array<TSESTree.TSUnionType | TSESTree.TSIntersectionType>>();
        const inspect = (node: TSESTree.TSUnionType | TSESTree.TSIntersectionType) => {
            const isNullable =
                node.type === AST_NODE_TYPES.TSUnionType &&
                node.types.filter((member) => !NULLISH_TYPE_KEYWORDS.has(member.type)).length === 1;
            const isAliased = context.sourceCode
                .getAncestors(node)
                .some((ancestor) => ancestor.type === AST_NODE_TYPES.TSTypeAliasDeclaration);
            if (isNullable || isAliased || node.types.length <= ALIAS_MEMBER_LIMIT) return;
            const key = node.types
                .map((member) => context.sourceCode.getText(member))
                .toSorted((left, right) => Number(left > right) - Number(left < right))
                .join('|');
            uses.set(key, [...(uses.get(key) ?? []), node]);
        };
        return {
            TSUnionType: inspect,
            TSIntersectionType: inspect,
            'Program:exit': function () {
                for (const nodes of uses.values()) {
                    const repeated = findRepeatedType(nodes);
                    if (repeated !== undefined) context.report(repeated);
                }
            },
        };
    },
});
