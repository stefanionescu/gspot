import { posix } from 'node:path';
import { createRule } from '../create-rule.ts';
import type { ImportSource } from '../types/syntax.ts';
import { INDEX_BASENAMES, IMPORT_SELECTOR } from '../config/rules/imports.ts';
import { ASTUtils, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { LOCAL_PREFIXES, MODULE_MOCK_METHODS } from '../config/rules/no-index-imports.ts';

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
            why: 'An import that names an index file hides the module that declares the value.',
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
                LOCAL_PREFIXES.every((prefix) => !source.startsWith(prefix)) ||
                !INDEX_BASENAMES.has(posix.basename(source))
            )
                return;
            context.report({ node, messageId: 'index', data: { source } });
        };
        return {
            // eslint-disable-next-line gspot/no-trivial-functions -- reason: ESLint calls it for each matching node.
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
                if (MODULE_MOCK_METHODS.get(node.callee.object.name)?.has(node.callee.property.name) === true)
                    check(node.arguments[0]);
            },
        };
    },
});
