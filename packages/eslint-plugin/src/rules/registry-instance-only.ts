import { createRule } from '#plugin/rules/definition.ts';
import type { TSESTree } from '@typescript-eslint/utils';
// An exported `new` instance outside a registry file.
import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { optionsSchema, stringList } from '#plugin/rules/options.ts';

import { lintedFile, lintedRoot, isAnyGlobMatch, relativeToRoot } from '#plugin/files.ts';

const WRAPPERS = new Set(['TSAsExpression', 'TSSatisfiesExpression', 'TSNonNullExpression', 'ChainExpression']);

function isConstructed(node: TSESTree.Node | null): boolean {
    let current: TSESTree.Node | null = node;
    while (current && WRAPPERS.has(current.type)) current = (current as { expression: TSESTree.Node }).expression;
    return current?.type === AST_NODE_TYPES.NewExpression;
}

export const registryInstanceOnly = createRule<RegistryInstanceOnlyOptions, 'registry'>({
    name: 'registry-instance-only',
    meta: {
        type: 'problem',
        docs: {
            example:
                'Given a `Client` constructor, `export const client = new Client();` in `src/turn/client.ts` reports `registry`. Move that declaration and its required import to `src/turn/registry.ts`, then update consumers.',
            summary: 'Finds an exported instance created with new outside a registry file.',
            why: 'An instance exported from anywhere is a hidden singleton; a registry file makes every shared instance visible in one place.',
            fix: "Create the instance in the module's registry file and import it from there.",
        },
        schema: [optionsSchema({ registryFiles: stringList })],
        messages: { registry: 'Exported instances created with new live in a registry file, not here.' },
    },
    defaultOptions: [{ registryFiles: ['**/registry.ts', '**/registry.tsx', '**/registry.js'] }],
    create(context, [options]) {
        const file = lintedFile(context);
        if (
            file === undefined ||
            isAnyGlobMatch(relativeToRoot(lintedRoot(context), file), options.registryFiles ?? [])
        )
            return {};
        return {
            ExportNamedDeclaration(node) {
                if (node.declaration?.type !== AST_NODE_TYPES.VariableDeclaration) return;
                for (const declarator of node.declaration.declarations)
                    if (declarator.init && isConstructed(declarator.init))
                        context.report({ node: declarator.init, messageId: 'registry' });
            },
            ExportDefaultDeclaration(node) {
                if (isConstructed(node.declaration)) context.report({ node: node.declaration, messageId: 'registry' });
            },
        };
    },
});

export type RegistryInstanceOnlyOptions = [{ registryFiles?: string[] }];
