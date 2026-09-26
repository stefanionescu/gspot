import { z } from 'zod';
import ts from 'typescript';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
import { mutationPath } from '#cli/platform/safe-paths.ts';
import type { eslintPreviewRequest, eslintPreviewResponse } from '#cli/evaluation/protocol.ts';

function moduleSource(path: string, text: string): string {
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const transformed = ts.transform(source, [
        (context) => {
            const visit: ts.Visitor = (node) => {
                if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
                    const target = import.meta.resolve(node.moduleSpecifier.text, pathToFileURL(path).href);
                    return context.factory.updateImportDeclaration(
                        node,
                        node.modifiers,
                        node.importClause,
                        context.factory.createStringLiteral(target),
                        node.attributes,
                    );
                }
                if (
                    ts.isPropertyAccessExpression(node) &&
                    node.name.text === 'url' &&
                    ts.isMetaProperty(node.expression) &&
                    node.expression.keywordToken === ts.SyntaxKind.ImportKeyword
                )
                    return context.factory.createStringLiteral(pathToFileURL(path).href);
                return ts.visitEachChild(node, visit, context);
            };
            return (node) => ts.visitEachChild(node, visit, context);
        },
    ]);
    try {
        return transformed.transformed.map((node) => ts.createPrinter().printFile(node)).join('\n');
    } finally {
        transformed.dispose();
    }
}

function ruleData(value: unknown): z.infer<typeof eslintPreviewResponse>[number] {
    const entries = z.array(z.record(z.string(), z.unknown())).parse(value);
    const rules = new Map<string, unknown[]>();
    for (const entry of entries) {
        if (entry['rules'] === undefined) continue;
        const table = z.record(z.string(), z.unknown()).parse(entry['rules']);
        for (const [name, setting] of Object.entries(table)) {
            const selected = rules.get(name) ?? [];
            selected.push({ files: entry['files'], ignores: entry['ignores'], basePath: entry['basePath'], setting });
            rules.set(name, selected);
        }
    }
    const serialized = JSON.stringify(Object.fromEntries(rules), (_key, entry: unknown) => {
        if (entry instanceof RegExp) return { pattern: entry.source, flags: entry.flags };
        if (typeof entry === 'function') {
            const scope: unknown = Reflect.get(entry, Symbol.for('gspot.eslint.scope'));
            if (scope !== undefined) return { scope, matcher: entry.toString() };
        }
        if (typeof entry === 'function' || typeof entry === 'symbol' || typeof entry === 'bigint')
            throw new Error('ESLint rule options contain a value that cannot be compared as data.');
        return entry;
    });
    return z.record(z.string(), z.json()).parse(JSON.parse(serialized));
}

/**
 * Resolve rule declarations in the configuration process without replacing either configuration on disk.
 * @param request the repository root, the configuration path, and the sources to compare
 * @param work the directory the configuration process runs in
 * @returns the rules each source resolves to
 */
export async function evaluateEslintPreview(
    request: z.infer<typeof eslintPreviewRequest>,
    work: string,
): Promise<z.infer<typeof eslintPreviewResponse>> {
    const path = resolve(request.root, ...mutationPath(request.path));
    // Every module is on disk before the first import: the runtime reads the directory once and keeps that listing.
    const modules = request.sources.map((source, index) => {
        const module = join(work, `eslint-preview-${String(index)}.mjs`);
        writeFileSync(module, moduleSource(path, source), { mode: 0o600 });
        return module;
    });
    const results: z.infer<typeof eslintPreviewResponse> = [];
    for (const module of modules) {
        const loaded = (await import(pathToFileURL(module).href)) as { default: unknown };
        results.push(ruleData(loaded.default));
    }
    return results;
}
