import { resolve } from 'node:path';
import { DRIVE_LETTER } from '../src/config/syntax.ts';
import type { SchemaLocationOptions } from './types.ts';
import { ASTUtils, ESLintUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    ZOD_MODULES,
    ZOD_UTILITIES,
    OPTIONS_SCHEMA,
    ZOD_NAMESPACE_IMPORTS,
    DEFAULT_SCHEMA_FOLDERS,
} from './config/schema-location.ts';

function findCall(callee: TSESTree.Node): TSESTree.Node[] {
    const { parent } = callee;
    if (parent?.type === AST_NODE_TYPES.MemberExpression && parent.object === callee) return findCall(parent);
    return parent?.type === AST_NODE_TYPES.CallExpression && parent.callee === callee ? [parent] : [];
}

function listNamespaceCalls(namespace: TSESTree.Identifier): TSESTree.Node[] {
    const member = namespace.parent;
    if (member.type !== AST_NODE_TYPES.MemberExpression || member.object !== namespace) return [];
    const name = ASTUtils.getPropertyName(member);
    return name === null || ZOD_UTILITIES.has(name) ? [] : findCall(member);
}

function getImportedName(specifier: TSESTree.ImportClause): string {
    if (specifier.type !== AST_NODE_TYPES.ImportSpecifier) return 'z';
    return specifier.imported.type === AST_NODE_TYPES.Identifier ? specifier.imported.name : specifier.imported.value;
}

function listZodSchemaCalls(source: TSESLint.SourceCode): TSESTree.Node[] {
    const modules: readonly unknown[] = ZOD_MODULES;
    return source.ast.body
        .flatMap((statement) =>
            statement.type === AST_NODE_TYPES.ImportDeclaration &&
            statement.importKind !== 'type' &&
            modules.includes(statement.source.value)
                ? statement.specifiers
                : [],
        )
        .flatMap((specifier) => {
            if (specifier.type === AST_NODE_TYPES.ImportSpecifier && specifier.importKind === 'type') return [];
            const imported = getImportedName(specifier);
            if (ZOD_UTILITIES.has(imported)) return [];
            const isNamespace =
                specifier.type === AST_NODE_TYPES.ImportNamespaceSpecifier || ZOD_NAMESPACE_IMPORTS.has(imported);
            return source
                .getDeclaredVariables(specifier)
                .flatMap((variable) => variable.references)
                .flatMap(({ identifier }) =>
                    isNamespace
                        ? listNamespaceCalls(identifier as TSESTree.Identifier)
                        : findCall(identifier as TSESTree.Identifier),
                );
        });
}

export const schemaLocation = ESLintUtils.RuleCreator.withoutDocs<SchemaLocationOptions, 'location'>({
    meta: {
        defaultOptions: [{ folders: DEFAULT_SCHEMA_FOLDERS }],
        type: 'suggestion',
        docs: {
            description:
                'Requires Zod schema construction in the configured schema folders: every call of a Zod export except the functions that only read, run, or describe schemas, such as safeParse and toJSONSchema.',
        },
        schema: [OPTIONS_SCHEMA],
        messages: { location: 'Declare this Zod schema in a configured schema folder: {{folders}}.' },
    },
    create(context, [options]) {
        const path = resolve(context.cwd, context.physicalFilename)
            .replaceAll('\\', '/')
            .replace(DRIVE_LETTER, (drive) => drive.toUpperCase());
        const folders = options.folders.map((folder) =>
            resolve(context.cwd, folder)
                .replaceAll('\\', '/')
                .replace(DRIVE_LETTER, (drive) => drive.toUpperCase()),
        );
        if (folders.some((folder) => path === folder || path.startsWith(`${folder}/`))) return {};
        return {
            Program() {
                for (const node of listZodSchemaCalls(context.sourceCode))
                    context.report({ node, messageId: 'location', data: { folders: options.folders.join(', ') } });
            },
        };
    },
});
