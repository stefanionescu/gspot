import type { TSESTree } from '@typescript-eslint/utils';
import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { createRule, optionsSchema } from '#plugin/definition.ts';
import { memberName, isGlobalEnvironmentHost } from '#plugin/environment.ts';

function readName(node: TSESTree.MemberExpression): string | undefined {
    const { parent } = node;
    return parent.type === AST_NODE_TYPES.MemberExpression && parent.object === node ? memberName(parent) : undefined;
}

export const noClientEnvironment = createRule<NoClientEnvironmentOptions, 'private'>({
    name: 'no-client-environment',
    meta: {
        type: 'problem',
        docs: {
            title: 'Keep private environment values on the server',
            example:
                'In a module beginning with `"use client"`, `const key = process.env.SECRET;` reports `private`. Move the secret read and the work that needs it to a server module. A genuinely public URL can use `process.env.NEXT_PUBLIC_URL` in the client. Never rename a secret to make it public. See [Next.js environment variables](https://nextjs.org/docs/app/guides/environment-variables).',
            level: 'recommended',
            summary: 'Finds a client module reading environment variables other than the public ones.',
            why: 'Client code needs public configuration. Private environment values are unavailable in the browser by default, and exposing a secret to satisfy the read is unsafe.',
            fix: 'Keep private configuration and the work that needs it in a server-only module. Pass only public results to client code, or use NEXT_PUBLIC_ variables for values intended for the browser.',
        },
        schema: [
            optionsSchema({
                clientModule: { type: 'boolean' },
                publicPrefixes: { type: 'array', items: { type: 'string' } },
                allowed: { type: 'array', items: { type: 'string' } },
            }),
        ],
        messages: {
            private:
                'A client module may read only public environment variables ({{public}}). Keep private configuration in a server-only module.',
        },
    },
    defaultOptions: [{ clientModule: false, publicPrefixes: ['NEXT_PUBLIC_'], allowed: ['NODE_ENV'] }],
    create(context, [options]) {
        const prefixes = options.publicPrefixes ?? ['NEXT_PUBLIC_'];
        const allowed = new Set(options.allowed ?? ['NODE_ENV']);
        const publicText = [...prefixes.map((prefix) => `${prefix}*`), ...allowed].join(', ');
        const isPublic = (name: string): boolean =>
            allowed.has(name) || prefixes.some((prefix) => name.startsWith(prefix));
        let isClient = options.clientModule === true;
        return {
            Program(node) {
                isClient ||= node.body.some(
                    (statement) =>
                        statement.type === AST_NODE_TYPES.ExpressionStatement && statement.directive === 'use client',
                );
            },
            VariableDeclarator(node) {
                if (
                    !isClient ||
                    !node.init ||
                    node.init.type !== AST_NODE_TYPES.Identifier ||
                    node.init.name !== 'process' ||
                    !isGlobalEnvironmentHost(context, node.init) ||
                    node.id.type !== AST_NODE_TYPES.ObjectPattern
                )
                    return;
                if (
                    node.id.properties.some(
                        (property) =>
                            property.type === AST_NODE_TYPES.RestElement ||
                            (property.key.type === AST_NODE_TYPES.Identifier
                                ? property.key.name
                                : String((property.key as TSESTree.Literal).value)) === 'env',
                    )
                )
                    context.report({ node, messageId: 'private', data: { public: publicText } });
            },
            MemberExpression(node) {
                if (
                    !isClient ||
                    node.object.type !== AST_NODE_TYPES.Identifier ||
                    node.object.name !== 'process' ||
                    !isGlobalEnvironmentHost(context, node.object) ||
                    memberName(node) !== 'env'
                )
                    return;
                const name = readName(node);
                if (name !== undefined && isPublic(name)) return;
                context.report({ node, messageId: 'private', data: { public: publicText } });
            },
        };
    },
});

export type NoClientEnvironmentOptions = [{ clientModule?: boolean; publicPrefixes?: string[]; allowed?: string[] }];
