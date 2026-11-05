import { posix } from 'node:path';

import { AST_NODE_TYPES, ASTUtils, type TSESTree } from '@typescript-eslint/utils';

import { INDEX_BASENAMES, LOCAL_PREFIXES, MODULE_MOCK_METHODS, RESOURCE_QUERY } from '../../config/structure.ts';
import { buildSourceVisitors } from '../../language/syntax.ts';
import { createRule } from '../../rule.ts';

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
                'Finds an import, re-export, `require`, or test mock path that names an index file instead of the module that declares the value.',
            why: 'An import that names an index file hides the module that declares the value.',
            fix: 'Import from the leaf module directly.',
        },
        schema: [],
        messages: { index: 'Import the owning module instead of the index "{{source}}".' },
    },
    create(context) {
        const checkSource = (node: TSESTree.Node): void => {
            const source = ASTUtils.getStringIfConstant(node);
            if (
                source === null ||
                RESOURCE_QUERY.test(source) ||
                LOCAL_PREFIXES.every((prefix) => !source.startsWith(prefix)) ||
                !INDEX_BASENAMES.has(posix.basename(source))
            )
                return;
            context.report({ node, messageId: 'index', data: { source } });
        };
        return {
            ...buildSourceVisitors(checkSource),
            CallExpression(node) {
                const [argument] = node.arguments;
                if (
                    argument === undefined ||
                    node.callee.type !== AST_NODE_TYPES.MemberExpression ||
                    node.callee.object.type !== AST_NODE_TYPES.Identifier ||
                    node.callee.property.type !== AST_NODE_TYPES.Identifier
                )
                    return;
                if (MODULE_MOCK_METHODS.get(node.callee.object.name)?.has(node.callee.property.name) === true)
                    checkSource(argument);
            },
        };
    },
});
