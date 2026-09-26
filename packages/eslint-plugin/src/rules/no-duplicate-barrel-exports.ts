import { parse } from '@typescript-eslint/typescript-estree';
import { createRule } from '#plugin/definition.ts';
import { dirname, join, resolve } from 'node:path';
import type { TSESTree } from '@typescript-eslint/utils';
import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { isIndexFile, lintedFile } from '#plugin/files.ts';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { EXTENSIONS } from '#plugin/constants/rules.ts';

function stemOf(path: string): string {
    const extension = EXTENSIONS.find((candidate) => path.endsWith(candidate));
    return extension === undefined ? path : path.slice(0, -extension.length);
}

function moduleFile(importer: string, source: string): string | undefined {
    if (!source.startsWith('.')) return undefined;
    const base = resolve(dirname(importer), source);
    const stem = stemOf(base);
    const candidates = [
        base,
        ...EXTENSIONS.map((extension) => `${stem}${extension}`),
        ...EXTENSIONS.map((extension) => join(base, `index${extension}`)),
    ];
    return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
}

// Each branch tracks its ancestors so recursive star exports terminate without hiding sibling exports.
function exportsOf(path: string, visited: Set<string>): Set<string> {
    if (visited.has(path)) return new Set();
    const ancestors = new Set([...visited, path]);
    const program = parse(readFileSync(path, 'utf8'), { jsx: /\.[jt]sx$/u.test(path) });
    return new Set(
        program.body.flatMap((statement) => namesOf(path, statement, ancestors)).filter((name) => name !== 'default'),
    );
}

function bindingNames(pattern: TSESTree.Node): string[] {
    switch (pattern.type) {
        case AST_NODE_TYPES.Identifier: {
            return [pattern.name];
        }
        case AST_NODE_TYPES.ArrayPattern: {
            return pattern.elements.flatMap((element) => (element === null ? [] : bindingNames(element)));
        }
        case AST_NODE_TYPES.ObjectPattern: {
            return pattern.properties.flatMap((property) =>
                bindingNames(property.type === AST_NODE_TYPES.RestElement ? property.argument : property.value),
            );
        }
        case AST_NODE_TYPES.AssignmentPattern: {
            return bindingNames(pattern.left);
        }
        case AST_NODE_TYPES.RestElement: {
            return bindingNames(pattern.argument);
        }
        default: {
            return [];
        }
    }
}

function declaredNames(declaration: TSESTree.ExportNamedDeclaration['declaration']): string[] {
    if (!declaration) return [];
    if ('id' in declaration && declaration.id?.type === AST_NODE_TYPES.Identifier) return [declaration.id.name];
    if (declaration.type === AST_NODE_TYPES.VariableDeclaration)
        return declaration.declarations.flatMap((entry) => bindingNames(entry.id));
    return [];
}

function namesOf(file: string, statement: TSESTree.Statement, visited = new Set<string>()): string[] {
    if (statement.type === AST_NODE_TYPES.ExportNamedDeclaration)
        return [
            ...declaredNames(statement.declaration),
            ...statement.specifiers.map((specifier) =>
                specifier.exported.type === AST_NODE_TYPES.Identifier
                    ? specifier.exported.name
                    : specifier.exported.value,
            ),
        ];
    if (statement.type !== AST_NODE_TYPES.ExportAllDeclaration || typeof statement.source.value !== 'string') return [];
    if (statement.exported !== null) return [statement.exported.name];
    const resolved = moduleFile(file, statement.source.value);
    return resolved === undefined ? [] : [...exportsOf(resolved, visited)];
}

export const noDuplicateBarrelExports = createRule<[], 'duplicate'>({
    name: 'no-duplicate-barrel-exports',
    meta: {
        type: 'problem',
        docs: {
            title: 'No duplicate barrel exports',
            example:
                'If `a.ts` and `b.ts` both export `two`, an `index.ts` containing `export * from "./a";` and `export * from "./b";` reports `duplicate`. Keep the first export and replace the second with `export { three } from "./b";` when `three` is the distinct public value needed from that module.',
            level: 'recommended',
            summary: 'Finds a name an index file exports twice, including through two export-all lines.',
            why: 'Two exports of one name leave the public contract without a single clear owner.',
            fix: 'Export the name once, or alias one of the two so both are reachable.',
        },
        schema: [],
        messages: { duplicate: 'The index exports "{{name}}" twice. Export it once, or alias one of them.' },
    },
    defaultOptions: [],
    create(context) {
        const file = lintedFile(context);
        if (file === undefined || !isIndexFile(file)) return {};
        return {
            Program(node) {
                const seen = new Set<string>();
                for (const statement of node.body)
                    for (const name of namesOf(file, statement)) {
                        if (seen.has(name)) context.report({ node: statement, messageId: 'duplicate', data: { name } });
                        seen.add(name);
                    }
            },
        };
    },
});
