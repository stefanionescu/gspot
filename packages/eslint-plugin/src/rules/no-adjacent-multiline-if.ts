import { createRule } from '../rule.ts';
import { type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function readPrecedingIf(node: TSESTree.IfStatement): TSESTree.IfStatement | undefined {
    const { parent } = node;
    if (
        parent.type !== AST_NODE_TYPES.Program &&
        parent.type !== AST_NODE_TYPES.BlockStatement &&
        parent.type !== AST_NODE_TYPES.SwitchCase
    )
        return undefined;
    const statements = parent.type === AST_NODE_TYPES.SwitchCase ? parent.consequent : parent.body;
    const previous = statements[statements.indexOf(node) - 1];
    return previous?.type === AST_NODE_TYPES.IfStatement ? previous : undefined;
}

export const noAdjacentMultilineIf = createRule<[], 'line'>({
    name: 'no-adjacent-multiline-if',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'all',
            description: 'Reports a multiline if statement whose closing line also starts the next independent if.',
            why: 'Two adjacent conditions can look like an if/else chain when the second starts beside the first closing brace.',
            fix: 'Start the next if on its own line. Add else only when the second condition must be mutually exclusive.',
            example: 'Put a line break between `}` and the following independent `if`.',
        },
        schema: [],
        messages: { line: 'Start this independent if on a new line, or add else when the branches must be exclusive.' },
    },
    create(context) {
        return {
            IfStatement: (node) => {
                const previous = readPrecedingIf(node);
                if (previous?.loc.end.line === node.loc.start.line && previous.loc.start.line !== node.loc.end.line)
                    context.report({ node, messageId: 'line' });
            },
        };
    },
});
