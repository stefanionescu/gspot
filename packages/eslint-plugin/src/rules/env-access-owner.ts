// process.env, import.meta.env, Bun.env and Deno.env read outside the declared configuration owner.
import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import { createRule, optionsSchema } from '#plugin/rules/definition.ts';
import { lintedFile, lintedRoot, isAnyGlobMatch, relativeToRoot } from '#plugin/files.ts';

const ENVIRONMENT_HOSTS = new Set(['process', 'Bun', 'Deno']);

/**
 *
 * @param node
 */
export function memberName(node: TSESTree.MemberExpression): string | undefined {
    if (node.computed) return node.property.type === AST_NODE_TYPES.Literal ? String(node.property.value) : undefined;
    return node.property.type === AST_NODE_TYPES.Identifier ? node.property.name : undefined;
}

/**
 *
 * @param context
 * @param node
 */
export function isGlobalEnvironmentHost(
    context: Readonly<TSESLint.RuleContext<string, unknown[]>>,
    node: TSESTree.Node,
): boolean {
    if (node.type !== AST_NODE_TYPES.Identifier || !ENVIRONMENT_HOSTS.has(node.name)) return false;
    let scope: TSESLint.Scope.Scope | null = context.sourceCode.getScope(node);
    while (scope !== null) {
        const variable = scope.set.get(node.name);
        if (variable !== undefined) return variable.defs.length === 0;
        scope = scope.upper;
    }
    return true;
}

function isEnvironmentRead(
    context: Readonly<TSESLint.RuleContext<string, unknown[]>>,
    node: TSESTree.MemberExpression,
): boolean {
    const property = memberName(node);
    if (property !== 'env') return false;
    const target = node.object;
    if (target.type === AST_NODE_TYPES.Identifier) return isGlobalEnvironmentHost(context, target);
    return (
        target.type === AST_NODE_TYPES.MetaProperty && target.meta.name === 'import' && target.property.name === 'meta'
    );
}

export const envAccessOwner = createRule<EnvAccessOwnerOptions, 'owner'>({
    name: 'env-access-owner',
    meta: {
        type: 'problem',
        docs: {
            title: 'Environment access owner',
            example:
                'In `src/turn/build.ts`, `const port = process.env.PORT;` reports an owner finding. Move the environment read to `src/env/index.ts` and pass the value to the build function.',
            summary: 'Finds an environment variable read outside the configuration owner.',
            why: 'When any file reads the environment, nobody can list what the program needs to run; one owner can.',
            fix: 'Read the variable in the configuration owner (architecture.roles.env) and pass the value where it is used.',
        },
        schema: [optionsSchema({ owners: { type: 'array', items: { type: 'string' } } })],
        messages: { owner: 'Environment variables are read in {{owners}} only. Read it there and pass the value in.' },
    },
    defaultOptions: [{ owners: ['src/env/**', 'config/**'] }],
    create(context, [options]) {
        const file = lintedFile(context);
        if (file === undefined) return {};
        const owners = options.owners ?? [];
        if (owners.length === 0 || isAnyGlobMatch(relativeToRoot(lintedRoot(context), file), owners)) return {};
        return {
            MemberExpression(node) {
                if (!isEnvironmentRead(context, node)) return;
                const { parent } = node;
                if (
                    parent.type === AST_NODE_TYPES.MemberExpression &&
                    parent.object === node &&
                    memberName(parent) === 'NODE_ENV'
                )
                    return;
                context.report({ node, messageId: 'owner', data: { owners: owners.join(', ') } });
            },
        };
    },
});

export type EnvAccessOwnerOptions = [{ owners?: string[] }];
