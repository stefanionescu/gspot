import { ASTUtils } from '@typescript-eslint/utils';
import type { TSESTree } from '@typescript-eslint/utils';
import type { ImportSource } from '#plugin/types/imports.ts';
import { createRule, optionsSchema } from '#plugin/definition.ts';
import { lintedPath, relativeImportPath } from '#plugin/files.ts';
import type { CrossScopeImportsOptions } from '#plugin/types/scope-imports.ts';

export const noCrossScopeImports = createRule<CrossScopeImportsOptions, 'escape'>({
    name: 'no-cross-scope-imports',
    meta: {
        defaultOptions: [{ scopes: [] }],
        type: 'suggestion',
        docs: {
            level: 'all',
            title: 'Keep imports within project boundaries',
            example:
                'With scopes `api` and `supabase`, an import of `../../supabase/src/a.js` from `api/src/b.ts` reports `escape`. Move shared behavior into a declared package dependency and import its package name. Relative imports within `api`, such as `../types/a.js`, remain in that scope.',
            description: 'Finds a relative import that reaches out of its scope into another one.',
            why: 'Scopes are separate projects; a path between them couples two builds that were meant to stay apart.',
            fix: 'Move the shared code into a package both scopes depend on, and import that package by name.',
        },
        schema: [
            optionsSchema({
                scopes: { type: 'array', items: { type: 'string' } },
            }),
        ],
        messages: {
            escape: 'This import leaves the scope "{{scope}}" for "{{target}}". Each scope imports only from within itself.',
        },
    },
    create(context, [configured]) {
        // RuleCreator merges the declared defaults before this listener is created.
        const options = configured as Required<CrossScopeImportsOptions[0]>;
        const file = lintedPath(context);
        if (file === undefined) return {};
        const { relative } = file;
        const scopes = options.scopes.toSorted((left, right) => right.length - left.length);
        const scope = scopes.find((entry) => relative === entry || relative.startsWith(`${entry}/`));
        if (scope === undefined) return {};
        const check = (node: TSESTree.Node | null | undefined): void => {
            if (!node) return;
            const source = ASTUtils.getStringIfConstant(node);
            if (source === null) return;
            const target = relativeImportPath(relative, source);
            if (target === undefined) return;
            if (target === scope || target.startsWith(`${scope}/`)) return;
            context.report({
                node,
                messageId: 'escape',
                data: {
                    scope,
                    target: scopes.find((entry) => target === entry || target.startsWith(`${entry}/`)) ?? target,
                },
            });
        };
        return {
            'ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression'(node: ImportSource) {
                check(node.source);
            },
        };
    },
});
