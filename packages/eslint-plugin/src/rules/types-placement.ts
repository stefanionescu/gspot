import type { TSESTree } from '@typescript-eslint/utils';
import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { TYPE_DECLARATIONS } from '#plugin/constants/rules.ts';
import { createRule, optionsSchema } from '#plugin/definition.ts';
import { lintedFile, lintedRoot, isAnyGlobMatch, relativeToRoot } from '#plugin/files.ts';
import type { TypesPlacementMessages, TypesPlacementOptions, TypesPlacementReporter } from '#plugin/types/rules.ts';

function isConstAssertion(init: TSESTree.Expression | null): init is TSESTree.TSAsExpression {
    return (
        init?.type === AST_NODE_TYPES.TSAsExpression &&
        init.typeAnnotation.type === AST_NODE_TYPES.TSTypeReference &&
        init.typeAnnotation.typeName.type === AST_NODE_TYPES.Identifier &&
        init.typeAnnotation.typeName.name === 'const'
    );
}

function isBraceLiteral(expression: TSESTree.Expression): boolean {
    return (
        expression.type === AST_NODE_TYPES.ObjectExpression &&
        expression.properties.every(
            (property) => property.type === AST_NODE_TYPES.Property && property.value.type === AST_NODE_TYPES.Literal,
        )
    );
}

function isEnumReplacement(declaration: TSESTree.VariableDeclaration): boolean {
    return (
        declaration.kind === 'const' &&
        declaration.declarations.some(
            (declarator) => isConstAssertion(declarator.init) && isBraceLiteral(declarator.init.expression),
        )
    );
}

function declarationName(declaration: NonNullable<TSESTree.ExportNamedDeclaration['declaration']>): string {
    if ('id' in declaration && declaration.id?.type === AST_NODE_TYPES.Identifier) return declaration.id.name;
    const first = declaration.type === AST_NODE_TYPES.VariableDeclaration ? declaration.declarations[0] : undefined;
    return first?.id.type === AST_NODE_TYPES.Identifier ? first.id.name : 'this export';
}

function isTypeOnlyImport(node: TSESTree.ImportDeclaration): boolean {
    if (node.importKind === 'type') return true;
    return (
        node.specifiers.length > 0 &&
        node.specifiers.every(
            (specifier) => specifier.type === AST_NODE_TYPES.ImportSpecifier && specifier.importKind === 'type',
        )
    );
}

function insideListeners(report: TypesPlacementReporter): Record<string, (node: never) => void> {
    return {
        ExportDefaultDeclaration(node: TSESTree.ExportDefaultDeclaration) {
            report(node, 'defaultInside');
        },
        ImportDeclaration(node: TSESTree.ImportDeclaration) {
            if (isTypeOnlyImport(node) || node.source.value.endsWith('.css')) return;
            report(node, 'valueImportInside', { source: node.source.value });
        },
        ExportNamedDeclaration(node: TSESTree.ExportNamedDeclaration) {
            const { declaration } = node;
            if (!declaration || TYPE_DECLARATIONS.has(declaration.type)) return;
            if (declaration.type === AST_NODE_TYPES.VariableDeclaration && isEnumReplacement(declaration)) return;
            report(node, 'runtimeInside', { name: declarationName(declaration) });
        },
    };
}

function outsideListeners(
    report: TypesPlacementReporter,
    isInterfaceAllowed: boolean,
): Record<string, (node: never) => void> {
    return {
        TSInterfaceDeclaration(node: TSESTree.TSInterfaceDeclaration) {
            if (!isInterfaceAllowed) report(node, 'interface');
        },
        TSTypeAliasDeclaration(node: TSESTree.TSTypeAliasDeclaration) {
            report(node, 'aliasOutside', { name: node.id.name });
        },
        ExportNamedDeclaration(node: TSESTree.ExportNamedDeclaration) {
            const { declaration } = node;
            if (declaration?.type !== AST_NODE_TYPES.VariableDeclaration || !isEnumReplacement(declaration)) return;
            report(node, 'enumOutside', {
                name: declarationName(declaration) === 'this export' ? 'this object' : declarationName(declaration),
            });
        },
    };
}

export const typesPlacement = createRule<TypesPlacementOptions, TypesPlacementMessages>({
    name: 'types-placement',
    meta: {
        type: 'problem',
        docs: {
            title: 'Place types with their owner',
            example:
                'With `typesDirectory: "types"`, `type A = string;` in `src/a.ts` reports `aliasOutside`. Declare and export `A` in `types/a.ts`, then use `import type { A } from "../types/a";` where the runtime code needs it.',
            summary: 'Enforces an explicitly configured type-only directory.',
            why: 'A repository can explicitly designate a type-only public contract directory. Types otherwise live beside their behavioral owners.',
            fix: 'Move the type under the types directory and import it with import type. Exceptions go through gspot ignore with a reason.',
        },
        schema: [
            optionsSchema({
                typesDirectory: { type: 'string' },
                allowInterface: { type: 'boolean' },
                exempt: { type: 'array', items: { type: 'string' } },
            }),
        ],
        messages: {
            interface: 'Use a type alias under {{directory}} instead of an interface.',
            aliasOutside: 'Type aliases live under {{directory}}. Move {{name}} there and import it with import type.',
            enumOutside:
                'An as-const object that stands in for an enum lives under {{directory}} beside its type. Move {{name}} there.',
            runtimeInside: 'Files under {{directory}} hold types only; {{name}} is a runtime value. Move it out.',
            defaultInside: 'Files under {{directory}} export no default. Export named types.',
            valueImportInside: 'Files under {{directory}} import types only. Write import type for "{{source}}".',
        },
    },
    defaultOptions: [{ allowInterface: false, exempt: [] }],
    create(context, [options]) {
        if (options.typesDirectory === undefined) return {};
        const file = lintedFile(context);
        if (file === undefined || file.endsWith('.d.ts')) return {};
        const relative = relativeToRoot(lintedRoot(context), file);
        if (isAnyGlobMatch(relative, options.exempt ?? [])) return {};
        const directory = options.typesDirectory.replace(/\/$/u, '');
        const isInside = relative.startsWith(`${directory}/`) || relative.includes(`/${directory}/`);
        const report: TypesPlacementReporter = (node, id, extra = {}) => {
            context.report({ node, messageId: id, data: { directory, ...extra } });
        };
        return isInside ? insideListeners(report) : outsideListeners(report, options.allowInterface === true);
    },
});
