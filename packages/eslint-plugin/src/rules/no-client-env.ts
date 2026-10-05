import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { createRule, optionsSchema } from '#plugin/definition.ts';
import { ENVIRONMENT_ALLOWED } from '#plugin/config/environment.ts';
import type { ClientEnvOptions } from '#plugin/types/environment.ts';
import { environmentNames, environmentReads } from '#plugin/environment.ts';

export const noClientEnv = createRule<ClientEnvOptions, 'private'>({
    name: 'no-client-env',
    meta: {
        defaultOptions: [{ isClient: false, publicPrefixes: ['NEXT_PUBLIC_'], allowed: ENVIRONMENT_ALLOWED }],
        type: 'problem',
        docs: {
            title: 'Keep private environment values on the server',
            example:
                'In a module beginning with `"use client"`, `const key = process.env.SECRET;` reports `private`. Move the secret read and the work that needs it to a server module. A genuinely public URL can use `process.env.NEXT_PUBLIC_URL` in the client. Never rename a secret to make it public. See [Next.js environment variables](https://nextjs.org/docs/app/guides/environment-variables).',
            level: 'recommended',
            description:
                'Finds private environment reads in client modules, including process.env, Bun.env, Deno.env, and import.meta.env. The publicPrefixes and allowed options name public values.',
            why: 'Client code needs public configuration. Private environment values are unavailable in the browser by default, and exposing a secret to satisfy the read is unsafe.',
            fix: 'Keep private configuration and the work that needs it in a server-only module. Pass only public results to client code, or use NEXT_PUBLIC_ variables for values intended for the browser.',
        },
        schema: [
            optionsSchema({
                isClient: { type: 'boolean' },
                publicPrefixes: { type: 'array', items: { type: 'string' } },
                allowed: { type: 'array', items: { type: 'string' } },
            }),
        ],
        messages: {
            private:
                'A client module may read only public environment variables ({{public}}). Keep private configuration in a server-only module.',
        },
    },
    create(context, [options]) {
        const prefixes = options.publicPrefixes;
        const allowed = new Set(options.allowed);
        const publicText = [...prefixes.map((prefix) => `${prefix}*`), ...allowed].join(', ');
        let isClient = options.isClient;
        return {
            ...environmentReads(context, (node) => {
                if (!isClient) return;
                const names = environmentNames(node);
                if (
                    names.length > 0 &&
                    names.every(
                        (name) =>
                            name !== null && (allowed.has(name) || prefixes.some((prefix) => name.startsWith(prefix))),
                    )
                )
                    return;
                context.report({ node, messageId: 'private', data: { public: publicText } });
            }),
            Program(node) {
                isClient ||= node.body.some(
                    (statement) =>
                        statement.type === AST_NODE_TYPES.ExpressionStatement && statement.directive === 'use client',
                );
            },
        };
    },
});
