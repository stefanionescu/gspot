import { createRule } from '../../rule.ts';
import { getNextStatement } from '../../language/syntax.ts';
import { EMPTY_LITERAL_DECLARATION } from '../../config/rules.ts';
import { type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function getAssignedProperty(node: TSESTree.VariableDeclaration): TSESTree.MemberExpression | undefined {
    const next = getNextStatement(node);
    if (next?.type !== AST_NODE_TYPES.ExpressionStatement) return undefined;
    const assignment = next.expression;
    if (assignment.type !== AST_NODE_TYPES.AssignmentExpression) return undefined;
    if (assignment.right.loc.start.line !== assignment.right.loc.end.line) return undefined;
    if (assignment.left.type !== AST_NODE_TYPES.MemberExpression) return undefined;
    if (assignment.left.object.type !== AST_NODE_TYPES.Identifier) return undefined;
    return assignment.left;
}

export const preferLiteral = createRule<[], 'literal'>({
    name: 'prefer-object-literal',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'all',
            description:
                'Reports an empty object immediately followed by a property assignment with a single-line value.',
            why: 'An object literal shows the initial properties together.',
            fix: 'Declare the initial properties inside the object literal and preserve the assignment semantics.',
            example: '`const user = {}; user.name = name;` becomes `const user = { name };`.',
        },
        schema: [],
        messages: { literal: 'Declare these initial properties in the object literal.' },
    },
    create(context) {
        return {
            [EMPTY_LITERAL_DECLARATION](declaration: TSESTree.VariableDeclarator) {
                const node = declaration.parent;
                const member = getAssignedProperty(node);
                if (member === undefined) return;
                const references = context.sourceCode
                    .getDeclaredVariables(node)
                    .filter(({ identifiers }) =>
                        identifiers.some((identifier) => identifier.range[0] === declaration.id.range[0]),
                    )
                    .flatMap((variable) => variable.references);
                if (!references.some(({ identifier }) => identifier.range[0] === member.object.range[0])) return;
                const assignment = member.parent as TSESTree.AssignmentExpression;
                if (
                    assignment.right.type === AST_NODE_TYPES.Identifier &&
                    references.some(({ identifier }) => identifier.range[0] === assignment.right.range[0])
                )
                    return;
                context.report({ node: declaration, messageId: 'literal' });
            },
        };
    },
});
