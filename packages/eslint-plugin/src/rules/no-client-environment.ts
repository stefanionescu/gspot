import { createRule } from '#plugin/rule.ts';
// `process.env` in a client module beyond NEXT_PUBLIC_* and NODE_ENV (Next.js).
import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { optionsSchema, stringList } from '#plugin/options.ts';
import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import type { NoClientEnvironmentOptions } from '#plugin-types/options.ts';

function memberName(node: TSESTree.MemberExpression): string | undefined {
    if (node.computed) return node.property.type === AST_NODE_TYPES.Literal ? String(node.property.value) : undefined;
    return node.property.type === AST_NODE_TYPES.Identifier ? node.property.name : undefined;
}

function isGlobalProcess(context: Readonly<TSESLint.RuleContext<string, unknown[]>>, node: TSESTree.Node): boolean {
    if (node.type !== AST_NODE_TYPES.Identifier || node.name !== 'process') return false;
    let scope: TSESLint.Scope.Scope | null = context.sourceCode.getScope(node);
    while (scope) {
        const variable = scope.set.get('process');
        if (variable) return variable.defs.length === 0;
        scope = scope.upper;
    }
    return true;
}

function readName(node: TSESTree.MemberExpression): string | undefined {
    const { parent } = node;
    return parent.type === AST_NODE_TYPES.MemberExpression && parent.object === node ? memberName(parent) : undefined;
}

export const noClientEnvironment = createRule<NoClientEnvironmentOptions, 'private'>({
    name: 'no-client-environment',
    meta: {
        type: 'problem',
        docs: {
            summary: 'Finds a client module reading environment variables other than the public ones.',
            why: 'A client bundle ships to the browser; a private variable read there is a secret leaked.',
            fix: 'Read private configuration in a server-only module and pass values down, or use a NEXT_PUBLIC_ variable for values meant for the browser.',
        },
        schema: [optionsSchema({ clientModule: { type: 'boolean' }, publicPrefixes: stringList, allowed: stringList })],
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
                    !isGlobalProcess(context, node.init) ||
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
                if (!isClient || !isGlobalProcess(context, node.object) || memberName(node) !== 'env') return;
                const name = readName(node);
                if (name !== undefined && isPublic(name)) return;
                context.report({ node, messageId: 'private', data: { public: publicText } });
            },
        };
    },
});
