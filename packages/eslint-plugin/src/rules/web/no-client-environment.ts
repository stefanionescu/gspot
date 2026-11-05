import { AST_NODE_TYPES, ASTUtils, type TSESLint, type TSESTree } from '@typescript-eslint/utils';

import {
    ALLOWED_ENVIRONMENT_NAMES,
    CLIENT_DIRECTIVE,
    CLIENT_ENVIRONMENT_OPTIONS_SCHEMA,
    ENVIRONMENT_GETTER,
    ENVIRONMENT_HOSTS,
    ENVIRONMENT_PROPERTY,
    PUBLIC_PREFIXES,
    VITE_ENVIRONMENT_NAMES,
} from '../../config/web.ts';
import { createRule } from '../../rule.ts';
import type { ClientEnvironmentOptions } from '../../types/security.ts';

function listHostEnvironmentReads(host: TSESTree.Identifier, source: TSESLint.SourceCode): TSESTree.Node[] {
    const { parent } = host;
    if (parent.type === AST_NODE_TYPES.MemberExpression && ASTUtils.getPropertyName(parent) === ENVIRONMENT_PROPERTY)
        return [parent];
    if (parent.type !== AST_NODE_TYPES.VariableDeclarator || parent.init !== host) return [];
    if (parent.id.type === AST_NODE_TYPES.ObjectPattern)
        return parent.id.properties.flatMap((property): TSESTree.Node[] => {
            if (
                property.type !== AST_NODE_TYPES.Property ||
                ASTUtils.getPropertyName(property) !== ENVIRONMENT_PROPERTY
            )
                return [];
            if (property.value.type !== AST_NODE_TYPES.Identifier) return [property];
            const variable = ASTUtils.findVariable(source.getScope(property.value), property.value);
            return (variable?.references ?? [])
                .filter((reference) => reference.isRead())
                .map((reference) => reference.identifier);
        });
    return source
        .getDeclaredVariables(parent)
        .flatMap((variable) => variable.references.filter((reference) => reference.isRead()))
        .flatMap((reference) => listHostEnvironmentReads(reference.identifier as TSESTree.Identifier, source));
}

function listGlobalEnvironmentReads(source: TSESLint.SourceCode): TSESTree.Node[] {
    const scope = source.getScope(source.ast);
    const hosts: readonly string[] = ENVIRONMENT_HOSTS;
    const reads = scope.through
        .filter(({ resolved, identifier }) => resolved === null && hosts.includes(identifier.name))
        .flatMap(({ identifier }) => listHostEnvironmentReads(identifier as TSESTree.Identifier, source));
    const tracker = new ASTUtils.ReferenceTracker(scope);
    const trace = Object.fromEntries(
        ENVIRONMENT_HOSTS.map((host) => [host, { [ENVIRONMENT_PROPERTY]: { [ASTUtils.ReferenceTracker.READ]: true } }]),
    );
    for (const reference of tracker.iterateGlobalReferences(trace)) reads.push(reference.node);
    return reads;
}

function getMemberName(member: TSESTree.MemberExpression): string | null {
    const name = ASTUtils.getPropertyName(member);
    const call = member.parent;
    if (name !== ENVIRONMENT_GETTER || call.type !== AST_NODE_TYPES.CallExpression || call.callee !== member)
        return name;
    const [argument] = call.arguments;
    return argument === undefined ? null : ASTUtils.getStringIfConstant(argument);
}

function listEnvironmentNames(node: TSESTree.Node): Array<string | null> {
    const { parent } = node;
    if (parent?.type === AST_NODE_TYPES.MemberExpression && parent.object === node) return [getMemberName(parent)];
    if (parent?.type === AST_NODE_TYPES.VariableDeclarator && parent.id.type === AST_NODE_TYPES.ObjectPattern)
        return parent.id.properties.map((property) =>
            property.type === AST_NODE_TYPES.RestElement ? null : ASTUtils.getPropertyName(property),
        );
    return [];
}

export const noClientEnvironment = createRule<ClientEnvironmentOptions, 'private'>({
    name: 'no-client-environment',
    meta: {
        defaultOptions: [{ client: false, publicPrefixes: PUBLIC_PREFIXES, allowedNames: ALLOWED_ENVIRONMENT_NAMES }],
        type: 'problem',
        docs: {
            example:
                'In a module beginning with `"use client"`, `const key = process.env.SECRET;` reports `private`. Move the secret read and the work that needs it to a server module. A genuinely public URL can use `process.env.NEXT_PUBLIC_URL` in the client. Never rename a secret to make it public. See [Next.js environment variables](https://nextjs.org/docs/app/guides/environment-variables).',
            level: 'recommended',
            description:
                'Finds private environment reads in client modules, such as `process.env.SECRET_KEY`, `Bun.env`, `Deno.env.get`, and `import.meta.env`. The `publicPrefixes` and `allowedNames` options name the public values.',
            why: 'Client code needs public configuration. Private environment values are unavailable in the browser by default, and exposing a secret to satisfy the read is unsafe.',
            fix: 'Keep private configuration and the work that needs it in a server-only module. Pass only public results to client code, or use NEXT_PUBLIC_ variables for values intended for the browser.',
        },
        schema: [CLIENT_ENVIRONMENT_OPTIONS_SCHEMA],
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
        const viteNames = new Set([...allowedNames, ...VITE_ENVIRONMENT_NAMES]);
        const publicText = [...prefixes.map((prefix) => `${prefix}*`), ...allowedNames].join(', ');
        const reportPrivateRead = (node: TSESTree.Node, publicNames: ReadonlySet<string>): void => {
            const names = listEnvironmentNames(node);
            if (
                names.length > 0 &&
                names.every(
                    (name) =>
                        name !== null && (publicNames.has(name) || prefixes.some((prefix) => name.startsWith(prefix))),
                )
            )
                return;
            context.report({ node, messageId: 'private', data: { public: publicText } });
        };
        return {
            MemberExpression: (node) => {
                if (
                    node.object.type === AST_NODE_TYPES.MetaProperty &&
                    node.object.meta.name === 'import' &&
                    node.object.property.name === 'meta' &&
                    ASTUtils.getPropertyName(node) === ENVIRONMENT_PROPERTY
                )
                    reportPrivateRead(node, viteNames);
            },
            'Program:exit'() {
                for (const access of listGlobalEnvironmentReads(context.sourceCode))
                    reportPrivateRead(access, allowedNames);
            },
        };
    },
});
