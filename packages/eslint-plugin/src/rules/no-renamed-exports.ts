import { isAlias } from '../syntax.ts';
import { createRule } from '../rule.ts';
import { type RenamedValue } from '../types/rules.ts';
import { type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function listRenamedProperties(pattern: TSESTree.ObjectPattern): RenamedValue[] {
    return pattern.properties.flatMap((property) => {
        if (property.type !== AST_NODE_TYPES.Property || property.computed) return [];
        const value = property.value.type === AST_NODE_TYPES.AssignmentPattern ? property.value.left : property.value;
        if (value.type === AST_NODE_TYPES.ObjectPattern) return listRenamedProperties(value);
        const source = property.key.type === AST_NODE_TYPES.Identifier ? property.key.name : String(property.key.value);
        return value.type === AST_NODE_TYPES.Identifier && value.name !== source
            ? [{ node: property, name: value.name, source }]
            : [];
    });
}

function listRenamedValues(declarator: TSESTree.VariableDeclarator, sourceCode: TSESLint.SourceCode): RenamedValue[] {
    const { id, init } = declarator;
    if (id.type === AST_NODE_TYPES.ObjectPattern) return listRenamedProperties(id);
    if (init === null || id.type !== AST_NODE_TYPES.Identifier || !isAlias(init, sourceCode.getScope(init))) return [];
    return [{ node: declarator, name: id.name, source: sourceCode.getText(init) }];
}

export const noRenamedExports = createRule<[], 'renamed'>({
    name: 'no-renamed-exports',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'all',
            example:
                'The declaration `import { b } from "./owner"; export const a = b;` reports `renamed`, and so do `export { b as a };` and `export const { b: a } = owner;`. Remove `a` and update its consumers to use `b` from its owner. A declaration that owns a value, such as `export const a = 1;`, does not report this finding, and neither does `export { main as default };`.',
            description:
                'Finds an export that only renames another value: an exported constant set to a bound value, a property that an exported destructuring pattern renames, or an export specifier written `a as b`, re-exports included.',
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
                const local = node.local.type === AST_NODE_TYPES.Identifier ? node.local.name : node.local.value;
                const name =
                    node.exported.type === AST_NODE_TYPES.Identifier ? node.exported.name : node.exported.value;
                if (local === name || local === 'default' || name === 'default') return;
                context.report({ node, messageId: 'renamed', data: { name, source: local } });
            },
        };
    },
});
