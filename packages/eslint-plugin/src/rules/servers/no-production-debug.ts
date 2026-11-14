import { createRule } from '../../rule.ts';
import { getQualifiedName } from '../../language/modules.ts';
import { listArgumentValues } from '../../language/expressions.ts';
import { type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { DEBUG_MIDDLEWARE, MIDDLEWARE_SELECTOR } from '../../config/servers.ts';

export const noProductionDebug = createRule<[], 'debugMiddleware'>({
    name: 'no-production-debug',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Finds `use` calls that add the `errorhandler` middleware outside an `if` statement, so that it runs in every environment.',
            why: 'The `errorhandler` middleware sends stack traces and other details of the server to the client, which helps attackers.',
            fix: 'Add the middleware only in development, inside a check such as `if (process.env.NODE_ENV === "development")`.',
            example:
                'The call `app.use(errorhandler())` at the top level of a module reports `debugMiddleware`. Wrap it in `if (process.env.NODE_ENV === "development") { app.use(errorhandler()); }`.',
        },
        schema: [],
        messages: { debugMiddleware: 'Turn this debug middleware off in production. Add it only in development.' },
    },
    create(context) {
        const source = context.sourceCode;
        return {
            [MIDDLEWARE_SELECTOR](node: TSESTree.CallExpression) {
                const isConditional = source.getAncestors(node).some(({ type }) => type === AST_NODE_TYPES.IfStatement);
                if (isConditional) return;
                for (const middleware of listArgumentValues(node.arguments, source))
                    if (
                        middleware.type === AST_NODE_TYPES.CallExpression &&
                        getQualifiedName(middleware, source) === DEBUG_MIDDLEWARE
                    )
                        context.report({ node: middleware, messageId: 'debugMiddleware' });
            },
        };
    },
});
