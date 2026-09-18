import { createRule } from '#plugin/rule.ts';
// A server module without `import 'server-only'` (Next.js).
import { AST_NODE_TYPES } from '@typescript-eslint/utils';

export const requireServerOnly = createRule<[], 'missing'>({
    name: 'require-server-only',
    meta: {
        type: 'problem',
        docs: {
            summary: 'Checks that a server module starts with import "server-only".',
            why: 'Without that import, a client component can pull the module in and ship its secrets to the browser.',
            fix: 'Add import "server-only" as the first line, or move the module out of the server file class.',
        },
        schema: [],
        messages: {
            missing: 'Mark this server module with import "server-only" so a client bundle can never include it.',
        },
    },
    defaultOptions: [],
    create(context) {
        return {
            Program(node) {
                if (
                    node.body.some(
                        (statement) =>
                            statement.type === AST_NODE_TYPES.ExpressionStatement &&
                            statement.directive === 'use server',
                    )
                )
                    return;
                if (
                    node.body.some(
                        (statement) =>
                            statement.type === AST_NODE_TYPES.ImportDeclaration &&
                            statement.source.value === 'server-only',
                    )
                )
                    return;
                context.report({ node, messageId: 'missing' });
            },
        };
    },
});
