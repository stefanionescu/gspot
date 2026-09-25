import { createRule } from '#plugin/definition.ts';
import { isIndexFile, lintedFile } from '#plugin/files.ts';

export const noReexportsOutsideIndex = createRule<[], 'outsideIndex'>({
    name: 'no-reexports-outside-index',
    meta: {
        type: 'problem',
        docs: {
            title: 'No reexports outside index',
            example:
                'The statement `export { b } from "./b";` in `src/c.ts` reports `outsideIndex`. Remove it and import `b` directly from its owner at each consumer. If the project explicitly uses an index contract, re-exports in `src/index.ts` are accepted by this rule.',
            summary: 'Finds a re-export in a file that is not an index.',
            why: 'Re-exports scattered through source make every value reachable by several paths, and tools lose the owner.',
            fix: 'Import from the module that declares the value; keep re-exports in index files if the repository allows them at all.',
        },
        schema: [],
        messages: {
            outsideIndex:
                'Re-exports belong in an index file, if anywhere. Import from the module that declares this value.',
        },
    },
    defaultOptions: [],
    create(context) {
        const file = lintedFile(context);
        if (file === undefined || isIndexFile(file)) return {};
        return {
            ExportAllDeclaration(node) {
                context.report({ node, messageId: 'outsideIndex' });
            },
            ExportNamedDeclaration(node) {
                if (node.source) context.report({ node, messageId: 'outsideIndex' });
            },
        };
    },
});
