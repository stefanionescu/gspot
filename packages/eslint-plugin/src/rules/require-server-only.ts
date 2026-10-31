import { createRule } from '../rule.ts';
import { type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { SERVER_DIRECTIVE, SERVER_ONLY_MODULE } from '../config/rules.ts';

export const requireServerOnly = createRule<[], 'missing'>({
    name: 'require-server-only',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'none',
            example:
                'A selected server module containing `export const secret = 1;` reports `missing`. With the `server-only` package installed, add `import "server-only";` before that declaration. `import type {} from "server-only"`, `import {} from "server-only"` and an import whose names are all type-only do not count, because TypeScript or Bun drop them from the output.',
            description:
                'Checks that a selected server module imports "server-only" in a form that stays in the built code, or declares "use server".',
            why: 'A server-only marker lets Next.js reject client imports of a module that uses private server capabilities. A marker that the compiler removes protects nothing.',
            fix: 'Add import "server-only" to the imports. Use "use server" only for a module that follows the Server Actions contract. If the file is not server code, remove it from the files this rule selects.',
        },
        schema: [],
        messages: {
            missing: 'Mark this server module with import "server-only" so a client bundle can never include it.',
        },
    },
    create(context) {
        const isRuntimeImport = (statement: TSESTree.ImportDeclaration): boolean => {
            if (statement.importKind === 'type' || statement.source.value !== SERVER_ONLY_MODULE) return false;
            if (statement.specifiers.length > 0)
                return statement.specifiers.some(
                    (specifier) => specifier.type !== AST_NODE_TYPES.ImportSpecifier || specifier.importKind !== 'type',
                );
            return (
                context.sourceCode.getTokenAfter(context.sourceCode.getFirstToken(statement) ?? statement)?.value !==
                '{'
            );
        };
        return {
            Program(node) {
                const isMarked = node.body.some(
                    (statement) =>
                        (statement.type === AST_NODE_TYPES.ExpressionStatement &&
                            statement.directive === SERVER_DIRECTIVE) ||
                        (statement.type === AST_NODE_TYPES.ImportDeclaration && isRuntimeImport(statement)),
                );
                if (!isMarked) context.report({ node, messageId: 'missing' });
            },
        };
    },
});
