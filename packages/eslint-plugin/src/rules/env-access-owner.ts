import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { createRule, optionsSchema } from '#plugin/definition.ts';
import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import type { EnvAccessOwnerOptions } from '#plugin/types/rules.ts';
import { isGlobalEnvironmentHost, memberName } from '#plugin/environment.ts';
import { isAnyGlobMatch, lintedFile, lintedRoot, relativeToRoot } from '#plugin/files.ts';

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
