import { posix } from 'node:path';
import { createRule } from '../create-rule.ts';
import { INDEX_BASENAMES } from '../config/paths.ts';
import { IMPORT_SELECTOR } from '../config/syntax.ts';
import type { ImportSource } from '../types/syntax.ts';
import { INTERNAL_PREFIXES, MODULE_MOCK_METHODS } from '../config/imports.ts';
import { ASTUtils, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

export const noIndexImports = createRule<[], 'index'>({
    name: 'no-index-imports',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'all',
            example:
                'The import `import { a } from "./index.js";` reports `index`. If `a.js` declares the value, use `import { a } from "./a.js";`.',
            description:
                'Finds an import that names an index file instead of the module that declares the value, including module paths in Vitest and Jest mocks. Folder imports such as ./lib are not reported.',
            why: 'An index import pulls in everything behind the barrel and hides which module the value comes from.',
            fix: 'Import from the leaf module directly.',
        },
        schema: [],
        messages: { index: 'Import the owning module instead of the index "{{source}}".' },
    },
    create(context) {
        const check = (node: TSESTree.Node | null | undefined): void => {
            if (!node) return;
            const source = ASTUtils.getStringIfConstant(node);
            if (
                source === null ||
                !INTERNAL_PREFIXES.some((prefix) => source.startsWith(prefix)) ||
                !INDEX_BASENAMES.has(posix.basename(source))
            )
                return;
            context.report({ node, messageId: 'index', data: { source } });
        };
        return {
            [IMPORT_SELECTOR](node: ImportSource) {
                check(node.source);
            },
            CallExpression(node) {
                if (
                    node.callee.type !== AST_NODE_TYPES.MemberExpression ||
                    node.callee.object.type !== AST_NODE_TYPES.Identifier ||
                    node.callee.property.type !== AST_NODE_TYPES.Identifier
                )
                    return;
                const framework = node.callee.object.name;
                if (!Object.hasOwn(MODULE_MOCK_METHODS, framework)) return;
                if (MODULE_MOCK_METHODS[framework as keyof typeof MODULE_MOCK_METHODS].has(node.callee.property.name))
                    check(node.arguments[0]);
            },
        };
    },
});
