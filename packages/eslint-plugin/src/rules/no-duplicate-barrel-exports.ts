import { createRule } from '#plugin/rule.ts';
// A name exported twice from one index, including through two `export *`.
import { dirname, join, resolve } from 'node:path';
import type { TSESTree } from '@typescript-eslint/utils';
import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { isIndexFile, lintedFile } from '#plugin/files.ts';
import { existsSync, readFileSync, statSync } from 'node:fs';

const EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];
const DECLARATION_KINDS = new Set([
    'function',
    'function*',
    'class',
    'const',
    'let',
    'var',
    'type',
    'interface',
    'enum',
    'async',
]);
const WORD = /^[A-Za-z_$][\w$]*/u;
const exportCache = new Map<string, Set<string>>();

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

function exportedName(part: string): string | undefined {
    const trimmed = part.trim();
    const cleaned = trimmed.startsWith('type ') ? trimmed.slice('type '.length).trim() : trimmed;
    if (cleaned === '') return undefined;
    const words = cleaned.split(/\s+/u);
    const asIndex = words.findIndex((word) => word.toLowerCase() === 'as');
    return asIndex === -1 ? cleaned : (words[asIndex + 1] ?? cleaned);
}

function nameAfterKeyword(rest: string): string | undefined {
    const words = rest.trimStart().split(/\s+/u);
    let index = 0;
    while (index < words.length && DECLARATION_KINDS.has(words[index] ?? '')) index += 1;
    if (index === 0 || index >= words.length) return undefined;
    return WORD.exec(words[index] ?? '')?.[0];
}

function namesInBraces(rest: string): string[] {
    const trimmed = rest.trimStart();
    const body = trimmed.startsWith('type ') ? trimmed.slice('type '.length).trimStart() : trimmed;
    if (!body.startsWith('{')) return [];
    const close = body.indexOf('}');
    if (close === -1) return [];
    return body
        .slice(1, close)
        .split(',')
        .map((part) => exportedName(part))
        .filter((name) => name !== undefined);
}

function starSource(rest: string): string | undefined {
    const words = rest.trim().split(/\s+/u);
    const quoted = words[2];
    if (quoted === undefined || quoted.length < 2 || words[0] !== '*' || words[1] !== 'from') return undefined;
    const end = quoted.indexOf(quoted[0] ?? '', 1);
    return end === -1 ? undefined : quoted.slice(1, end);
}

function exportStatements(content: string): string[] {
    return content.split('export ').slice(1);
}

function namesInText(content: string): Set<string> {
    const names = new Set<string>();
    for (const rest of exportStatements(content)) {
        const declared = nameAfterKeyword(rest);
        if (declared !== undefined) names.add(declared);
        for (const name of namesInBraces(rest)) names.add(name);
    }
    return names;
}

function existingText(path: string): string {
    try {
        return readFileSync(path, 'utf8');
    } catch {
        return '';
    }
}

function exportsOf(path: string, visited = new Set<string>()): Set<string> {
    if (visited.has(path)) return new Set();
    visited.add(path);
    const cached = exportCache.get(path);
    if (cached) return cached;
    const content = existingText(path);
    const names = namesInText(content);
    const sources = exportStatements(content)
        .map((rest) => starSource(rest))
        .filter((source) => source !== undefined);
    for (const source of sources) {
        const resolved = moduleFile(path, source);
        if (resolved === undefined) continue;
        const nested = exportsOf(resolved, new Set(visited));
        for (const name of nested) names.add(name);
    }
    exportCache.set(path, names);
    return names;
}

function declaredNames(declaration: TSESTree.ExportNamedDeclaration['declaration']): string[] {
    if (!declaration) return [];
    if ('id' in declaration && declaration.id?.type === AST_NODE_TYPES.Identifier) return [declaration.id.name];
    if (declaration.type === AST_NODE_TYPES.VariableDeclaration)
        return declaration.declarations.flatMap((entry) =>
            entry.id.type === AST_NODE_TYPES.Identifier ? [entry.id.name] : [],
        );
    return [];
}

function specifierNames(statement: TSESTree.ExportNamedDeclaration): string[] {
    return statement.specifiers.map((specifier) =>
        specifier.exported.type === AST_NODE_TYPES.Identifier ? specifier.exported.name : specifier.exported.value,
    );
}

function namesOf(file: string, statement: TSESTree.Statement): string[] {
    if (statement.type === AST_NODE_TYPES.ExportNamedDeclaration)
        return [...declaredNames(statement.declaration), ...specifierNames(statement)];
    if (statement.type !== AST_NODE_TYPES.ExportAllDeclaration || typeof statement.source.value !== 'string') return [];
    const resolved = moduleFile(file, statement.source.value);
    return resolved === undefined ? [] : [...exportsOf(resolved)];
}

/** Drops the export cache; the tests plant files between cases. */
export function resetExportCache(): void {
    exportCache.clear();
}

export const noDuplicateBarrelExports = createRule<[], 'duplicate'>({
    name: 'no-duplicate-barrel-exports',
    meta: {
        type: 'problem',
        docs: {
            summary: 'Finds a name an index file exports twice, including through two export-all lines.',
            why: 'Two exports of one name shadow each other, and which one wins depends on order nobody reads.',
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
