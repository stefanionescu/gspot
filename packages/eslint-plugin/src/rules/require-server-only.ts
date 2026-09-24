import { createRule } from '#plugin/rules/definition.ts';
// A server module without `import 'server-only'` (Next.js).
import { AST_NODE_TYPES } from '@typescript-eslint/utils';

export const requireServerOnly = createRule<[], 'missing'>({
    name: 'require-server-only',
    meta: {
        type: 'problem',
        docs: {
            title: 'Mark server modules explicitly',
            example:
                'A selected server module containing `export const secret = 1;` reports `missing`. With the `server-only` package installed, add `import "server-only";` before that declaration.',
            summary: 'Checks that a selected server module imports "server-only" or declares "use server".',
            why: 'A server-only marker lets Next.js reject client imports of a module that uses private server capabilities.',
            fix: 'Add import "server-only" to the imports. Use "use server" only for a module that follows the Server Actions contract. Remove an incorrect server file classification when appropriate.',
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
