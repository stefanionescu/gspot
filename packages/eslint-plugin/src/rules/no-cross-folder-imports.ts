import { ASTUtils } from '@typescript-eslint/utils';
import { createRule, optionsSchema } from '#plugin/definition.ts';
import { lintedPath, relativeImportPath } from '#plugin/files.ts';
import { type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import type { ImportSource, CrossFolderImportsOptions } from '#plugin/types/rules.ts';

function aliasFor(target: string, aliases: Record<string, string>): string | undefined {
    for (const [prefix, directory] of Object.entries(aliases)) {
        const base = directory.replace(/\*$/u, '').replace(/\/$/u, '');
        if (target === base || target.startsWith(`${base}/`))
            return `${prefix.replace(/\*$/u, '')}${target.slice(base.length + 1)}`;
    }
    return undefined;
}

function topFolder(file: string, root: string): string | undefined {
    const prefix = root === '.' ? '' : `${root}/`;
    if (!file.startsWith(prefix)) return undefined;
    const path = file.slice(prefix.length);
    return path.includes('/') ? path.split('/', 1)[0] : undefined;
}

export const noCrossFolderImports = createRule<CrossFolderImportsOptions, 'alias' | 'escape'>({
    name: 'no-cross-folder-imports',
    meta: {
        defaultOptions: [{ aliases: {} }],
        type: 'suggestion',
        fixable: 'code',
        docs: {
            level: 'all',
            title: 'Keep imports within folder boundaries',
            example:
                'With `@/` mapped to `src/`, `import { a } from "../turn/a.js";` in `src/other/b.ts` reports `alias`. Correct the import to `import { a } from "@/turn/a.js";`.',
            description: 'Finds relative imports that leave their top-level folder under a source root.',
            why: 'A path of ../../ ties the importer to the tree shape; the alias names the folder and survives a move.',
            fix: 'Keep relative imports within a top-level folder. eslint --fix uses a configured alias when one exists.',
        },
        schema: [
            optionsSchema({
                aliases: { type: 'object', additionalProperties: { type: 'string' } },
            }),
        ],
        messages: {
            alias: 'Import "{{alias}}" instead of climbing folders with "{{source}}".',
            escape: 'Relative import "{{source}}" leaves the "{{folder}}" folder. Import through an alias, or move the shared code into this folder.',
        },
    },
    create(context, [configured]) {
        // RuleCreator merges the declared defaults before this listener is created.
        const options = configured as Required<CrossFolderImportsOptions[0]>;
        const file = lintedPath(context);
        if (file === undefined) return {};
        const { relative } = file;
        const candidates = [relative.split('/', 1)[0] ?? ''];
        const sourceRoot = candidates
            .filter((entry) => entry === '.' || relative.startsWith(`${entry}/`))
            .toSorted((left, right) => right.length - left.length)[0];
        if (sourceRoot === undefined) return {};
        const folder = topFolder(relative, sourceRoot);
        if (folder === undefined) return {};
        const aliases = options.aliases;
        const check = (node: TSESTree.Node | null | undefined): void => {
            if (node?.type !== AST_NODE_TYPES.Literal) return;
            const source = ASTUtils.getStringIfConstant(node);
            if (source === null) return;
            const target = relativeImportPath(relative, source);
            if (target === undefined) return;
            if (topFolder(target, sourceRoot) === folder) return;
            const alias = aliasFor(target, aliases);
            const literal = node;
            const quote = literal.raw.charAt(0);
            if (alias === undefined) {
                context.report({ node: literal, messageId: 'escape', data: { source, folder } });
            } else {
                context.report({
                    node: literal,
                    messageId: 'alias',
                    data: { alias, source },
                    fix: (fixer) => fixer.replaceText(literal, `${quote}${alias}${quote}`),
                });
            }
        };
        return {
            'ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression'(node: ImportSource) {
                check(node.source);
            },
        };
    },
});
