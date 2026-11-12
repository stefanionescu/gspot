import { AST_NODE_TYPES, ASTUtils, type TSESLint, type TSESTree } from '@typescript-eslint/utils';

import { CSRF_CHANGING_METHODS, CSRF_MODULE, CSRF_SAFE_METHODS, MIDDLEWARE_METHOD } from '../../config/servers.ts';
import { getOptionProperties, listArgumentValues } from '../../language/expressions.ts';
import { getQualifiedName, listImportedModules } from '../../language/modules.ts';
import { createRule } from '../../rule.ts';

function findIgnoredMethod(
    source: Readonly<TSESLint.SourceCode>,
    node: TSESTree.CallExpression,
): TSESTree.Node | undefined {
    const [options] = node.arguments;
    const methods =
        options?.type === AST_NODE_TYPES.ObjectExpression
            ? getOptionProperties(options, source).get('ignoreMethods')
            : null;
    const elements = methods?.value.type === AST_NODE_TYPES.ArrayExpression ? methods.value.elements : [];
    return (
        elements.find(
            (element) =>
                element?.type === AST_NODE_TYPES.Literal &&
                typeof element.value === 'string' &&
                !CSRF_SAFE_METHODS.has(element.value),
        ) ?? undefined
    );
}

export const requireCsrfMiddleware = createRule<[], 'ignoredMethod' | 'unprotectedRoute'>({
    name: 'require-csrf-middleware',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'In a file that imports `csurf`, finds `post`, `put`, `delete`, and `patch` routes that run without the `csurf` middleware, and an `ignoreMethods` option that skips a method other than GET, HEAD, and OPTIONS.',
            why: 'A route that changes data without a CSRF check lets another site send that change in the name of a signed-in user.',
            fix: 'Add the `csurf` middleware with `app.use` before the routes, or pass it to each route that changes data. Keep only safe methods in `ignoreMethods`.',
            example:
                'After `const csrf = csurf();`, the route `app.post("/transfer", transfer)` reports `unprotectedRoute`. Use `app.post("/transfer", csrf, transfer)`.',
        },
        schema: [],
        messages: {
            ignoredMethod: 'Check CSRF tokens for this method. Keep only GET, HEAD, and OPTIONS in ignoreMethods.',
            unprotectedRoute: 'Protect this route against CSRF. Pass the csurf middleware to it, or use it before.',
        },
    },
    create(context) {
        const source = context.sourceCode;
        const isImported = listImportedModules(source).has(CSRF_MODULE);
        let isAppProtected = false;
        const checkRoute = (node: TSESTree.CallExpression, method: string | null): void => {
            const values = method === MIDDLEWARE_METHOD ? listArgumentValues(node.arguments, source) : node.arguments;
            const isProtected = values.some((value) => getQualifiedName(value, source) === CSRF_MODULE);
            if (method === MIDDLEWARE_METHOD) isAppProtected ||= isProtected;
            else if (isImported && !isAppProtected && !isProtected && CSRF_CHANGING_METHODS.has(method))
                context.report({ node: node.callee, messageId: 'unprotectedRoute' });
        };
        return {
            CallExpression(node) {
                const ignored =
                    getQualifiedName(node.callee, source) === CSRF_MODULE ? findIgnoredMethod(source, node) : undefined;
                if (ignored) context.report({ node: ignored, messageId: 'ignoredMethod' });
                checkRoute(
                    node,
                    node.callee.type === AST_NODE_TYPES.MemberExpression ? ASTUtils.getPropertyName(node.callee) : null,
                );
            },
        };
    },
});
