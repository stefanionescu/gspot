import { createRule } from '../../rule.ts';
import { isAlias } from '../../language/syntax.ts';
import { type RenamedValue } from '../../types/structure.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function listPropertyRenames(property: TSESTree.Property | TSESTree.RestElement): RenamedValue[] {
    if (property.type !== AST_NODE_TYPES.Property || property.computed) return [];
    const value = property.value.type === AST_NODE_TYPES.AssignmentPattern ? property.value.left : property.value;
    if (value.type === AST_NODE_TYPES.ObjectPattern)
        return value.properties.flatMap((nested) => listPropertyRenames(nested));
    const source = property.key.type === AST_NODE_TYPES.Identifier ? property.key.name : String(property.key.value);
    return value.type === AST_NODE_TYPES.Identifier && value.name !== source
        ? [{ node: property, name: value.name, source }]
        : [];
}

function findExportRename(
    node: TSESTree.ExportSpecifier,
    sourceCode: TSESLint.SourceCode,
): { name: string; source: string } | undefined {
    const local = sourceCode.getText(node.local);
    const name = node.exported.type === AST_NODE_TYPES.Identifier ? node.exported.name : node.exported.value;
    if (local === 'default' || name === 'default') return undefined;
    const source = findSourceName(node, local, sourceCode);
    return source === name ? undefined : { name, source };
}

function findSourceName(node: TSESTree.ExportSpecifier, local: string, sourceCode: TSESLint.SourceCode): string {
    const definition = ASTUtils.findVariable(sourceCode.getScope(node), local)?.defs[0]?.node;
    if (definition?.type !== AST_NODE_TYPES.ImportSpecifier) return local;
    const { imported } = definition;
    return imported.type === AST_NODE_TYPES.Identifier ? imported.name : imported.value;
}

function listRenamedValues(declarator: TSESTree.VariableDeclarator, sourceCode: TSESLint.SourceCode): RenamedValue[] {
    const { id, init } = declarator;
    if (id.type === AST_NODE_TYPES.ObjectPattern)
        return id.properties.flatMap((property) => listPropertyRenames(property));
    return init === null || id.type !== AST_NODE_TYPES.Identifier || !isAlias(init, sourceCode.getScope(init))
        ? []
        : [{ node: declarator, name: id.name, source: sourceCode.getText(init) }];
}

export const noRenamedExports = createRule<[], 'renamed'>({
    name: 'no-renamed-exports',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'all',
            example:
                'The declaration `import { b } from "./owner"; export const a = b;` reports `renamed`, and so do `export { b as a };`, `export const { b: a } = owner;`, and `import { b as a } from "./owner"; export { a };`. Remove `a` and update its consumers to use `b` from its owner. A declaration that owns a value, such as `export const a = 1;`, does not report this finding, and neither does `export { main as default };`.',
            description:
                'Finds an export that only renames another value: an exported constant set to a bound value, a property that an exported destructuring pattern renames, or an export specifier written `a as b`, or an export specifier whose import renamed the value. A re-export is the job of `gspot/no-trivial-files`.',
            why: 'Two names for one value split every search and every reader in two.',
            fix: 'Export the source value under its own name, or import the source where the renamed constant was used.',
        },
        schema: [],
        messages: { renamed: '{{name}} only renames {{source}}. Export the source value under its own name.' },
    },
    create(context) {
        return {
            ExportNamedDeclaration(node) {
                if (node.declaration?.type !== AST_NODE_TYPES.VariableDeclaration || node.declaration.kind !== 'const')
                    return;
                for (const declarator of node.declaration.declarations)
                    for (const { node: renamed, name, source } of listRenamedValues(declarator, context.sourceCode))
                        context.report({ node: renamed, messageId: 'renamed', data: { name, source } });
            },
            ExportSpecifier(node) {
                if (node.parent.source !== null) return;
                const rename = findExportRename(node, context.sourceCode);
                if (rename !== undefined) context.report({ node, messageId: 'renamed', data: rename });
            },
        };
    },
});
