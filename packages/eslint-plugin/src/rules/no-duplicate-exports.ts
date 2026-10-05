import { createRule } from '#plugin/definition.ts';
import { join, dirname, resolve } from 'node:path';
import { EXTENSIONS } from '#plugin/config/files.ts';
import { getDeclarationNames } from '#plugin/syntax.ts';
import { lintedPath, isIndexFile } from '#plugin/files.ts';
import { parse } from '@typescript-eslint/typescript-estree';
import { statSync, existsSync, readFileSync } from 'node:fs';
import type { ExportSources } from '#plugin/types/export-sources.ts';
import { type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function moduleFile(importer: string, source: string): string | undefined {
    if (!source.startsWith('.')) return undefined;
    const base = resolve(dirname(importer), source);
    const extension = EXTENSIONS.find((candidate) => base.endsWith(candidate));
    const stem = extension === undefined ? base : base.slice(0, -extension.length);
    const candidates = [
        base,
        ...EXTENSIONS.map((extension) => `${stem}${extension}`),
        ...EXTENSIONS.map((extension) => join(base, `index${extension}`)),
    ];
    return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
}

// Each branch tracks its ancestors so recursive star exports terminate without hiding sibling exports.
function readModuleExports(path: string, sources: ExportSources): Set<string> {
    if (sources.ancestors.has(path)) return new Set();
    const ancestors = new Set([...sources.ancestors, path]);
    // Without a root, the parser guesses one from every configuration the process loaded, and fails on two.
    let program = sources.modules.get(path);
    if (program === undefined) {
        program = parse(readFileSync(path, 'utf8'), {
            jsx: /\.[jt]sx$/u.test(path),
            tsconfigRootDir: dirname(path),
        });
        sources.modules.set(path, program);
    }
    return new Set(
        program.body
            .flatMap((statement) => getExportNames(path, statement, { ...sources, ancestors }))
            .filter((name) => name !== 'default'),
    );
}

function getExportNames(file: string, statement: TSESTree.Statement, sources: ExportSources): string[] {
    if (statement.type === AST_NODE_TYPES.ExportNamedDeclaration)
        return [
            ...getDeclarationNames(statement.declaration),
            ...statement.specifiers.map((specifier) =>
                specifier.exported.type === AST_NODE_TYPES.Identifier
                    ? specifier.exported.name
                    : specifier.exported.value,
            ),
        ];
    if (statement.type !== AST_NODE_TYPES.ExportAllDeclaration || typeof statement.source.value !== 'string') return [];
    if (statement.exported !== null) return [statement.exported.name];
    const resolved = moduleFile(file, statement.source.value);
    return resolved === undefined ? [] : [...readModuleExports(resolved, sources)];
}

// The existing typed program owns alias resolution and recursive export symbols; standalone rules keep relative resolution.
function getTypedExports(
    context: Readonly<TSESLint.RuleContext<string, unknown[]>>,
    statement: TSESTree.Statement,
): string[] | undefined {
    if (statement.type !== AST_NODE_TYPES.ExportAllDeclaration || statement.exported !== null) return undefined;
    const { program, esTreeNodeToTSNodeMap: mapping } = context.sourceCode.parserServices ?? {};
    if (!program || mapping === undefined) return undefined;
    const checker = program.getTypeChecker();
    const symbol = checker.getSymbolAtLocation(mapping.get(statement.source));
    return symbol === undefined
        ? undefined
        : checker
              .getExportsOfModule(symbol)
              .map((entry) => entry.getName())
              .filter((name) => name !== 'default');
}

export const noDuplicateExports = createRule<[], 'duplicate'>({
    name: 'no-duplicate-exports',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            title: 'No duplicate barrel exports',
            example:
                'If `a.ts` and `b.ts` both export `two`, an `index.ts` containing `export * from "./a";` and `export * from "./b";` reports `duplicate`. Export `two` from one module only, for example `export * from "./a"; export { other } from "./b";`.',
            level: 'recommended',
            description:
                "Finds a name an index file exports twice, including through two export-all lines. With type information, sources use the project compiler's module resolution, including aliases. Without it, the rule follows relative sources.",
            why: 'Two exports of one name leave the public contract without a single clear owner.',
            fix: 'Export the name once, or alias one of the two so both are reachable.',
        },
        schema: [],
        messages: { duplicate: 'The index exports "{{name}}" twice. Export it once, or alias one of them.' },
    },
    create(context) {
        const file = lintedPath(context);
        if (file === undefined || !isIndexFile(file.absolute)) return {};
        return {
            Program(node) {
                const seen = new Set<string>();
                const sources: ExportSources = { modules: new Map(), ancestors: new Set([file.absolute]) };
                for (const statement of node.body)
                    for (const name of getTypedExports(context, statement) ??
                        getExportNames(file.absolute, statement, sources)) {
                        if (seen.has(name)) context.report({ node: statement, messageId: 'duplicate', data: { name } });
                        seen.add(name);
                    }
            },
        };
    },
});
