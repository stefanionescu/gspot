import { isImportLike } from '#plugin/imports.ts';
import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import type { LayoutMessages } from '#plugin/types/plugin.ts';
import type { ImportLayoutOptions } from '#plugin/types/rules.ts';
import { createRule, optionsSchema } from '#plugin/definition.ts';
import { runsOf, reportRun, reportNames } from '#plugin/layout.ts';

export const importLayout = createRule<ImportLayoutOptions, LayoutMessages>({
    name: 'import-layout',
    meta: {
        type: 'layout',
        fixable: 'code',
        docs: {
            level: 'all',
            title: 'Import layout',
            example:
                'The import block below reports `layout`:\n\n```ts\nimport { ccc } from "ccc";\nimport a from "a";\n```\n\nPut the shorter import first:\n\n```ts\nimport a from "a";\nimport { ccc } from "ccc";\n```\n\nThe names inside braces follow the same order: `import { bb, a } from "x"` reports `names`, and `import { a, bb } from "x"` passes.',
            summary:
                'Checks that imports are grouped one-line first, multi-line second, and sorted by length within each group, and that the names inside braces are sorted by length.',
            why: 'One layout for imports means a diff shows the import that changed, not a reshuffle.',
            fix: 'Run gspot check --fix; the rule rewrites the block and the names.',
        },
        schema: [optionsSchema({ allowRequire: { type: 'boolean' } })],
        messages: {
            layout: 'Imports go one-line first, then multi-line, each sorted by length.',
            names: 'The names inside braces go shortest first.',
        },
    },
    defaultOptions: [{ allowRequire: false }],
    create(context, [options]) {
        const isRequireAllowed = options.allowRequire === true;
        return {
            Program(node) {
                for (const run of runsOf(node.body, (statement) => isImportLike(statement, isRequireAllowed)))
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
