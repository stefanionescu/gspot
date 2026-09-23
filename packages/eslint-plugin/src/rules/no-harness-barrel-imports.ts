import { createRule } from '#plugin/rules/definition.ts';
import { optionsSchema, stringList } from '#plugin/rules/options.ts';

// An import from a test-harness barrel.
import { lintedFile, lintedRoot, isAnyGlobMatch, relativeToRoot, staticString } from '#plugin/files.ts';

export const noHarnessBarrelImports = createRule<HarnessBarrelImportsOptions, 'barrel'>({
    name: 'no-harness-barrel-imports',
    meta: {
        type: 'problem',
        docs: {
            example:
                'With `barrels: ["@tests/harness"]`, importing `a` from `@tests/harness` inside `tests/harness/b.ts` reports `barrel`. Import it from its owner with `import { a } from "@tests/harness/a.js";`.',
            summary: 'Finds an import of the test-harness barrel from inside the harness code itself.',
            why: 'Support modules that import their own barrel create cycles and load every sandbox to use one.',
            fix: 'Import the specific harness module instead of the barrel.',
        },
        schema: [optionsSchema({ barrels: stringList, within: stringList })],
        messages: { barrel: 'Import the specific module instead of the harness barrel "{{source}}".' },
    },
    defaultOptions: [{ barrels: [], within: ['**/tests/harness/**'] }],
    create(context, [options]) {
        const file = lintedFile(context);
        if (file === undefined || !isAnyGlobMatch(relativeToRoot(lintedRoot(context), file), options.within ?? []))
            return {};
        const barrels = new Set(options.barrels);
        return {
            ImportDeclaration(node) {
                const source = staticString(node.source);
                if (source !== undefined && barrels.has(source))
                    context.report({ node: node.source, messageId: 'barrel', data: { source } });
            },
        };
    },
});

export type HarnessBarrelImportsOptions = [{ barrels?: string[]; within?: string[] }];
