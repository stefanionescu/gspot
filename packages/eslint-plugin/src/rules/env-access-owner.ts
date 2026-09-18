import { createRule } from '#plugin/rule.ts';
import type { TSESTree } from '@typescript-eslint/utils';
// process.env, import.meta.env, Bun.env and Deno.env read outside the declared configuration owner.
import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { optionsSchema, stringList } from '#plugin/options.ts';
import type { EnvAccessOwnerOptions } from '#plugin-types/options.ts';
import { lintedFile, lintedRoot, isAnyGlobMatch, relativeToRoot } from '#plugin/files.ts';

const ENVIRONMENT_HOSTS = new Set(['process', 'Bun', 'Deno']);

function memberName(node: TSESTree.MemberExpression): string | undefined {
    if (node.computed) return node.property.type === AST_NODE_TYPES.Literal ? String(node.property.value) : undefined;
    return node.property.type === AST_NODE_TYPES.Identifier ? node.property.name : undefined;
}

function isEnvironmentRead(node: TSESTree.MemberExpression): boolean {
    const property = memberName(node);
    if (property !== 'env') return false;
    const target = node.object;
    if (target.type === AST_NODE_TYPES.Identifier) return ENVIRONMENT_HOSTS.has(target.name);
    return (
        target.type === AST_NODE_TYPES.MetaProperty && target.meta.name === 'import' && target.property.name === 'meta'
    );
}

export const envAccessOwner = createRule<EnvAccessOwnerOptions, 'owner'>({
    name: 'env-access-owner',
    meta: {
        type: 'problem',
        docs: {
            summary: 'Finds an environment variable read outside the configuration owner.',
            why: 'When any file reads the environment, nobody can list what the program needs to run; one owner can.',
            fix: 'Read the variable in the configuration owner (architecture.roles.env) and pass the value where it is used.',
        },
        schema: [optionsSchema({ owners: stringList })],
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
                if (!isEnvironmentRead(node)) return;
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
