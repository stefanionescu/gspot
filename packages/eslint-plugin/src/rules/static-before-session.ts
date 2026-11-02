import { createRule } from '../rule.ts';
import type { FunctionNode } from '../types/rules.ts';
import { getQualifiedName } from '../language/modules.ts';
import { listArgumentValues } from '../language/expressions.ts';
import { ASTUtils, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    EXPRESS_MODULE,
    STATIC_MIDDLEWARE,
    MIDDLEWARE_SELECTOR,
    SESSION_MIDDLEWARES,
    INJECTED_APPLICATION,
} from '../config/servers.ts';

function findInjectedApplication(node: FunctionNode): TSESTree.Identifier | undefined {
    const { parent } = node;
    const target = parent.type === AST_NODE_TYPES.AssignmentExpression ? parent.left : undefined;
    const isExported =
        target?.type === AST_NODE_TYPES.MemberExpression &&
        [target, target.object].some(
            (member) =>
                member.type === AST_NODE_TYPES.MemberExpression &&
                member.object.type === AST_NODE_TYPES.Identifier &&
                member.object.name === 'module' &&
                ASTUtils.getPropertyName(member) === 'exports',
        );
    return isExported
        ? node.params.find(
              (parameter): parameter is TSESTree.Identifier =>
                  ASTUtils.isIdentifier(parameter) && parameter.name === INJECTED_APPLICATION,
          )
        : undefined;
}

export const staticBeforeSession = createRule<[], 'staticAfterSession'>({
    name: 'static-before-session',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Finds `app.use(express.static(…))` calls that come after the `express-session` or `cookie-session` middleware on the same Express app.',
            why: 'Static files then pass through the session middleware, which sets session cookies on responses that caches and other users can receive.',
            fix: 'Add the static middleware before the session middleware.',
            example:
                'The calls `app.use(session(options)); app.use(express.static("public"));` report `staticAfterSession` on the second call. Swap the two calls.',
        },
        schema: [],
        messages: { staticAfterSession: 'Add this static middleware before the session middleware.' },
    },
    create(context) {
        const source = context.sourceCode;
        let application: TSESTree.Identifier | undefined;
        let session: TSESTree.CallExpression | undefined;
        const saved: { application: TSESTree.Identifier | undefined; session: TSESTree.CallExpression | undefined }[] =
            [];
        return {
            ':function'(node: FunctionNode) {
                saved.push({ application, session });
                const injected = findInjectedApplication(node);
                if (injected === undefined) return;
                application = injected;
                session = undefined;
            },
            ':function:exit'() {
                const previous = saved.pop();
                application = previous?.application;
                session = previous?.session;
            },
            VariableDeclarator(node) {
                const isApplication =
                    node.init?.type === AST_NODE_TYPES.CallExpression &&
                    getQualifiedName(node.init, source) === EXPRESS_MODULE;
                if (!isApplication || node.id.type !== AST_NODE_TYPES.Identifier) return;
                application = node.id;
                session = undefined;
            },
            [MIDDLEWARE_SELECTOR](node: TSESTree.CallExpression) {
                const { object } = node.callee as TSESTree.MemberExpression;
                if (application === undefined || !ASTUtils.isIdentifier(object) || object.name !== application.name)
                    return;
                const names = listArgumentValues(node.arguments, source).map((middleware) =>
                    middleware.type === AST_NODE_TYPES.CallExpression
                        ? getQualifiedName(middleware, source)
                        : undefined,
                );
                for (const name of names) {
                    if (SESSION_MIDDLEWARES.has(name)) session = node;
                    else if (session && name === STATIC_MIDDLEWARE)
                        context.report({ node, messageId: 'staticAfterSession' });
                }
            },
        };
    },
});
