import { createRule, optionsSchema } from '../create-rule.ts';
import type { RuleContext, ClientEnvOptions } from '../types/rules.ts';
import { PUBLIC_PREFIXES, CLIENT_DIRECTIVE } from '../config/nextjs.ts';
import { ENVIRONMENT_HOSTS, ENVIRONMENT_ALLOWED } from '../config/environment.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

// Undeclared hosts have no local binding; direct member reads and destructuring use the same property test.
function directEnvironmentAccess(identifier: TSESTree.Identifier): TSESTree.Node[] {
    const hosts: readonly string[] = ENVIRONMENT_HOSTS;
    if (!hosts.includes(identifier.name)) return [];
    const { parent } = identifier;
    if (parent.type === AST_NODE_TYPES.MemberExpression && ASTUtils.getPropertyName(parent) === 'env') return [parent];
    if (parent.type !== AST_NODE_TYPES.VariableDeclarator || parent.id.type !== AST_NODE_TYPES.ObjectPattern) return [];
    return parent.id.properties.filter(
        (property) => property.type === AST_NODE_TYPES.Property && ASTUtils.getPropertyName(property) === 'env',
    );
}

/**
 * Find environment access through global hosts, aliases, destructuring, and import.meta.
 * @param context the rule context and effective source scopes.
 * @param inspect the rule's decision for each environment access.
 * @returns listeners that find environment access once.
 */
function environmentListeners(context: RuleContext, inspect: (node: TSESTree.Node) => void): TSESLint.RuleListener {
    return {
        MemberExpression(node) {
            if (
                node.object.type === AST_NODE_TYPES.MetaProperty &&
                node.object.meta.name === 'import' &&
                node.object.property.name === 'meta' &&
                ASTUtils.getPropertyName(node) === 'env'
            )
                inspect(node);
        },
        'Program:exit'(node) {
            const scope = context.sourceCode.getScope(node);
            for (const reference of scope.through) {
                if (reference.resolved !== null) continue;
                for (const access of directEnvironmentAccess(reference.identifier as TSESTree.Identifier))
                    inspect(access);
            }
            const tracker = new ASTUtils.ReferenceTracker(scope);
            const trace = Object.fromEntries(
                ENVIRONMENT_HOSTS.map((host) => [host, { env: { [ASTUtils.ReferenceTracker.READ]: true } }]),
            );
            for (const reference of tracker.iterateGlobalReferences(trace)) inspect(reference.node);
        },
    };
}

/**
 * Read the statically named variables taken from an environment object. An empty list means the whole object or a dynamic key.
 * @param node the environment access.
 * @returns variable names used directly or through destructuring.
 */
function environmentNames(node: TSESTree.Node): (string | null)[] {
    const { parent } = node;
    if (parent?.type === AST_NODE_TYPES.MemberExpression && parent.object === node)
        return [ASTUtils.getPropertyName(parent)];
    if (parent?.type === AST_NODE_TYPES.VariableDeclarator && parent.id.type === AST_NODE_TYPES.ObjectPattern)
        return parent.id.properties.map((property) =>
            property.type === AST_NODE_TYPES.RestElement ? null : ASTUtils.getPropertyName(property),
        );
    return [];
}

export const noClientEnv = createRule<ClientEnvOptions, 'private'>({
    name: 'no-client-env',
    meta: {
        defaultOptions: [{ isClient: false, publicPrefixes: PUBLIC_PREFIXES, allowed: ENVIRONMENT_ALLOWED }],
        type: 'problem',
        docs: {
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
                isClient: {
                    description: 'Treat selected files as client code without a use-client directive.',
                    type: 'boolean',
                },
                publicPrefixes: {
                    description: 'Prefixes allowed for public environment variables.',
                    type: 'array',
                    items: { type: 'string' },
                },
                allowed: {
                    description: 'Environment variable names allowed in client code.',
                    type: 'array',
                    items: { type: 'string' },
                },
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
            ...environmentListeners(context, (node) => {
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
                        statement.type === AST_NODE_TYPES.ExpressionStatement &&
                        statement.directive === CLIENT_DIRECTIVE,
                );
            },
        };
    },
});
