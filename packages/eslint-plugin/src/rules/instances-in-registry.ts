import { unwrap } from '#plugin/syntax.ts';
import { lintedPath, isAnyGlobMatch } from '#plugin/files.ts';
import { createRule, optionsSchema } from '#plugin/definition.ts';
import type { InstancesInRegistryOptions } from '#plugin/types/rules.ts';
import { REGISTRY_FILES, VALUE_CONSTRUCTORS } from '#plugin/config/rules.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function isConstructed(
    context: Readonly<TSESLint.RuleContext<string, unknown[]>>,
    node: TSESTree.Node | null,
): boolean {
    const current = unwrap(node);
    if (current?.type !== AST_NODE_TYPES.NewExpression) return false;
    if (current.callee.type !== AST_NODE_TYPES.Identifier || !VALUE_CONSTRUCTORS.has(current.callee.name)) return true;
    const variable = ASTUtils.findVariable(context.sourceCode.getScope(current.callee), current.callee.name);
    return variable !== null && variable.defs.length > 0;
}

export const instancesInRegistry = createRule<InstancesInRegistryOptions, 'registry'>({
    name: 'instances-in-registry',
    meta: {
        defaultOptions: [{ files: REGISTRY_FILES }],
        type: 'suggestion',
        docs: {
            level: 'none',
            title: 'Export one registry instance',
            example:
                'Given a `Client` constructor, `export const client = new Client();` in `src/turn/client.ts` reports `registry`. Move that declaration and its required import to `src/turn/registry.ts`, then update consumers.',
            description: 'Finds an exported instance created with new outside a registry file.',
            why: 'An instance exported from anywhere is a hidden singleton; a registry file makes every shared instance visible in one place.',
            fix: "Create the instance in the module's registry file and import it from there.",
        },
        schema: [optionsSchema({ files: { type: 'array', items: { type: 'string' } } })],
        messages: { registry: 'Exported instances created with new live in a registry file, not here.' },
    },
    create(context, [configured]) {
        // RuleCreator merges the declared defaults before this listener is created.
        const options = configured as Required<InstancesInRegistryOptions[0]>;
        const file = lintedPath(context);
        if (file === undefined || isAnyGlobMatch(file.relative, options.files)) return {};
        return {
            ExportNamedDeclaration(node) {
                if (node.declaration?.type !== AST_NODE_TYPES.VariableDeclaration) return;
                for (const declarator of node.declaration.declarations)
                    if (declarator.init && isConstructed(context, declarator.init))
                        context.report({ node: declarator.init, messageId: 'registry' });
            },
            ExportDefaultDeclaration(node) {
                if (isConstructed(context, node.declaration))
                    context.report({ node: node.declaration, messageId: 'registry' });
            },
        };
    },
});
