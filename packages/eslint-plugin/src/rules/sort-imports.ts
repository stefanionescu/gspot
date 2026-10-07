import { isImportLike } from '#plugin/imports.ts';
import { createRule } from '#plugin/create-rule.ts';
import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import type { LayoutMessages } from '#plugin/types/layout.ts';
import { runsOf, reportRun, reportNames } from '#plugin/layout.ts';

export const sortImports = createRule<[], LayoutMessages>({
    name: 'sort-imports',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        fixable: 'code',
        docs: {
            level: 'all',
            title: 'Import layout',
            example:
                'The import block below reports `layout`:\n\n```ts\nimport { ccc } from "ccc";\nimport a from "a";\n```\n\nPut the shorter import first:\n\n```ts\nimport a from "a";\nimport { ccc } from "ccc";\n```\n\nThe names inside braces follow the same order: `import { bb, a } from "x"` reports `names`, and `import { a, bb } from "x"` passes.',
            description:
                'Checks that imports are grouped one-line first, multi-line second, and sorted by length within each group, and that the names inside braces are sorted by length.',
            why: 'One layout for imports means a diff shows the import that changed, not a reshuffle.',
            fix: 'Run eslint --fix; the rule rewrites the block and the names.',
        },
        schema: [],
        messages: {
            layout: 'Imports go one-line first, then multi-line, each shortest first.',
            names: 'The names inside braces go shortest first.',
        },
    },
    create(context) {
        return {
            Program(node) {
                // Side-effect imports mark execution boundaries and keep their relative position.
                for (const run of runsOf(
                    node.body,
                    (statement) =>
                        isImportLike(statement, context) &&
                        !(statement.type === AST_NODE_TYPES.ImportDeclaration && statement.specifiers.length === 0) &&
                        statement.type !== AST_NODE_TYPES.ExpressionStatement,
                ))
                    reportRun(context, run);
            },
            ImportDeclaration(node) {
                reportNames(
                    context,
                    node.specifiers.filter((specifier) => specifier.type === AST_NODE_TYPES.ImportSpecifier),
                );
            },
        };
    },
});
