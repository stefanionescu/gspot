import { createRule } from '#plugin/definition.ts';
import type { LayoutMessages } from '#plugin/types/layout.ts';
import { runsOf, reportRun, reportNames } from '#plugin/layout.ts';
import { type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

// An export block is made of export lists and re-exports; an exported declaration is code, not a block member.
function isExportList(node: TSESTree.Statement): boolean {
    if (node.type === AST_NODE_TYPES.ExportAllDeclaration) return true;
    return node.type === AST_NODE_TYPES.ExportNamedDeclaration && node.declaration === null;
}

export const sortExports = createRule<[], LayoutMessages>({
    name: 'sort-exports',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        fixable: 'code',
        docs: {
            level: 'all',
            title: 'Export layout',
            example:
                'The export block below reports `layout`:\n\n```ts\nexport { ccc } from "./ccc";\nexport { a } from "./a";\n```\n\nPut the shorter export first:\n\n```ts\nexport { a } from "./a";\nexport { ccc } from "./ccc";\n```\n\nThe names inside braces follow the same order: `export { bb, a }` reports `names`, and `export { a, bb }` passes.',
            description:
                'Checks that export lists and re-exports are grouped one-line first, multi-line second, and sorted by length within each group, and that the names inside braces are sorted by length.',
            why: 'One layout for exports means a diff shows the export that changed, not a reshuffle.',
            fix: 'Run eslint --fix; the rule rewrites the block and the names.',
        },
        schema: [],
        messages: {
            layout: 'Exports go one-line first, then multi-line, each sorted by length.',
            names: 'The names inside braces go shortest first.',
        },
    },
    create(context) {
        return {
            Program(node) {
                for (const run of runsOf(node.body, isExportList)) reportRun(context, run);
            },
            ExportNamedDeclaration(node) {
                if (node.declaration === null) reportNames(context, node.specifiers);
            },
        };
    },
});
