import { createRule } from '../../rule.ts';
import type { FileContext } from '../../types/plugin.ts';
import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { readPackageFacts } from '../../language/packages.ts';
import { PACKAGE_NAME, LOCAL_PREFIXES, WORKSPACE_PROTOCOL } from '../../config/structure.ts';

/**
Tell whether the repository owns a module: a path inside it, or a package that a manifest takes from the workspace.
The export of such a module can take the name that the import wants.
*/
function isRepositoryModule(specifier: string, context: FileContext): boolean {
    if (LOCAL_PREFIXES.some((prefix) => specifier.startsWith(prefix))) return true;
    const range = readPackageFacts(context).dependencies.get(PACKAGE_NAME.exec(specifier)?.[0] ?? '');
    return range?.startsWith(WORKSPACE_PROTOCOL) === true;
}

export const noRenamedImports = createRule<[], 'renamed'>({
    name: 'no-renamed-imports',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'all',
            description:
                'Reports an import that renames a value of a module of the repository, such as `import { a as b }` from a relative path, a `#` subpath import, or a workspace package, when nothing else in the file is named `a`.',
            why: 'Two names for one value split every search and every reader in two.',
            fix: 'Rename the export to the name that the file needs, or use the exported name in the file.',
            example:
                "`import { RULES as NAMING_RULES } from '#cli/config/naming.ts';` reports `renamed`. Export the value as `NAMING_RULES`. `import { stringify as stringifyToml } from '@decimalturn/toml-patch';` does not report this finding, because another project owns the package, and neither does an alias in a file that already holds the bare name.",
        },
        schema: [],
        messages: {
            renamed: 'Rename the export instead of the import (JAVASCRIPT.md: keep the exported name).',
        },
    },
    create(context) {
        const scopes = context.sourceCode.scopeManager?.scopes ?? [];
        return {
            ImportSpecifier(node) {
                const { imported, local, parent } = node;
                if (imported.type !== AST_NODE_TYPES.Identifier || imported.name === local.name) return;
                if (imported.name === 'default' || parent.type !== AST_NODE_TYPES.ImportDeclaration) return;
                if (!isRepositoryModule(parent.source.value, context)) return;
                if (scopes.every((scope) => !scope.set.has(imported.name)))
                    context.report({ node, messageId: 'renamed' });
            },
        };
    },
});
