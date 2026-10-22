import { createRule } from '../schemas/rules/options.ts';
import type { ClientEnvOptions } from '../types/rules.ts';
import { PUBLIC_PREFIXES, CLIENT_DIRECTIVE } from '../config/nextjs.ts';
import { clientEnvOptionsSchema } from '../schemas/rules/no/client-env.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { ENVIRONMENT_HOSTS, ENVIRONMENT_PROPERTY, ALLOWED_ENVIRONMENT_NAMES } from '../config/environment.ts';

// ReferenceTracker skips hosts that the config does not declare as globals, so this reads their env member and
// destructuring directly.
function listDirectEnvironmentReads(identifier: TSESTree.Identifier): TSESTree.Node[] {
    const hosts: readonly string[] = ENVIRONMENT_HOSTS;
    if (!hosts.includes(identifier.name)) return [];
    const { parent } = identifier;
    if (parent.type === AST_NODE_TYPES.MemberExpression && ASTUtils.getPropertyName(parent) === ENVIRONMENT_PROPERTY)
        return [parent];
    if (parent.type !== AST_NODE_TYPES.VariableDeclarator || parent.id.type !== AST_NODE_TYPES.ObjectPattern) return [];
    return parent.id.properties.filter(
        (property) =>
            property.type === AST_NODE_TYPES.Property && ASTUtils.getPropertyName(property) === ENVIRONMENT_PROPERTY,
    );
}

/**
 * List environment reads through global hosts, aliases, and destructuring.
 *
 * @param scope the source scope with unresolved global references
 * @returns the nodes that read a global environment object
 */
function listGlobalEnvironmentReads(scope: TSESLint.Scope.Scope): TSESTree.Node[] {
    const reads: TSESTree.Node[] = [];
    for (const reference of scope.through) {
        if (reference.resolved !== null) continue;
        reads.push(...listDirectEnvironmentReads(reference.identifier as TSESTree.Identifier));
    }
    const tracker = new ASTUtils.ReferenceTracker(scope);
    const trace = Object.fromEntries(
        ENVIRONMENT_HOSTS.map((host) => [host, { [ENVIRONMENT_PROPERTY]: { [ASTUtils.ReferenceTracker.READ]: true } }]),
    );
    for (const reference of tracker.iterateGlobalReferences(trace)) reads.push(reference.node);
    return reads;
}

/**
 * List the names read from an environment object, with null for a computed key or a rest element. An empty list means
 * that the code reads the whole object.
 *
 * @param node the environment access
 * @returns the names read directly or through destructuring
 */
function listEnvironmentNames(node: TSESTree.Node): (string | null)[] {
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
        defaultOptions: [{ client: false, publicPrefixes: PUBLIC_PREFIXES, allowedNames: ALLOWED_ENVIRONMENT_NAMES }],
        type: 'problem',
        docs: {
            example:
                'In a module beginning with `"use client"`, `const key = process.env.SECRET;` reports `private`. Move the secret read and the work that needs it to a server module. A genuinely public URL can use `process.env.NEXT_PUBLIC_URL` in the client. Never rename a secret to make it public. See [Next.js environment variables](https://nextjs.org/docs/app/guides/environment-variables).',
            level: 'recommended',
            description:
                'Finds private environment reads in client modules, including process.env, Bun.env, Deno.env, and import.meta.env. The publicPrefixes and allowedNames options name public values.',
            why: 'Client code needs public configuration. Private environment values are unavailable in the browser by default, and exposing a secret to satisfy the read is unsafe.',
            fix: 'Keep private configuration and the work that needs it in a server-only module. Pass only public results to client code, or use NEXT_PUBLIC_ variables for values intended for the browser.',
        },
        schema: [clientEnvOptionsSchema],
        messages: {
            private:
                'A client module may read only public environment variables ({{public}}). Keep private configuration in a server-only module.',
        },
    },
    create(context, [options]) {
        const isClient =
            options.client ||
            context.sourceCode.ast.body.some(
                (statement) =>
                    statement.type === AST_NODE_TYPES.ExpressionStatement && statement.directive === CLIENT_DIRECTIVE,
            );
        if (!isClient) return {};
        const prefixes = options.publicPrefixes;
        const allowedNames = new Set(options.allowedNames);
        const publicText = [...prefixes.map((prefix) => `${prefix}*`), ...allowedNames].join(', ');
        const report = (node: TSESTree.Node): void => {
            const names = listEnvironmentNames(node);
            if (
                names.length > 0 &&
                names.every(
                    (name) =>
                        name !== null && (allowedNames.has(name) || prefixes.some((prefix) => name.startsWith(prefix))),
                )
            )
                return;
            context.report({ node, messageId: 'private', data: { public: publicText } });
        };
        return {
            MemberExpression(node) {
                if (
                    node.object.type === AST_NODE_TYPES.MetaProperty &&
                    node.object.meta.name === 'import' &&
                    node.object.property.name === 'meta' &&
                    ASTUtils.getPropertyName(node) === ENVIRONMENT_PROPERTY
                )
                    report(node);
            },
            'Program:exit'(node) {
                for (const access of listGlobalEnvironmentReads(context.sourceCode.getScope(node))) report(access);
            },
        };
    },
});
