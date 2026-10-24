import { createRule } from '../create-rule.ts';
import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { SERVER_DIRECTIVE, SERVER_ONLY_MODULE } from '../config/rules/require-server-only.ts';

export const requireServerOnly = createRule<[], 'missing'>({
    name: 'require-server-only',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'none',
            example:
                'A selected server module containing `export const secret = 1;` reports `missing`. With the `server-only` package installed, add `import "server-only";` before that declaration.',
            description: 'Checks that a selected server module imports "server-only" or declares "use server".',
            why: 'A server-only marker lets Next.js reject client imports of a module that uses private server capabilities.',
            fix: 'Add import "server-only" to the imports. Use "use server" only for a module that follows the Server Actions contract. If the file is not server code, remove it from the files this rule selects.',
        },
        schema: [],
        messages: {
            missing: 'Mark this server module with import "server-only" so a client bundle can never include it.',
        },
    },
    create(context) {
        return {
            Program(node) {
                const isMarked = node.body.some(
                    (statement) =>
                        (statement.type === AST_NODE_TYPES.ExpressionStatement &&
                            statement.directive === SERVER_DIRECTIVE) ||
                        (statement.type === AST_NODE_TYPES.ImportDeclaration &&
                            statement.importKind === 'value' &&
                            statement.source.value === SERVER_ONLY_MODULE),
                );
                if (!isMarked) context.report({ node, messageId: 'missing' });
            },
        };
    },
});
